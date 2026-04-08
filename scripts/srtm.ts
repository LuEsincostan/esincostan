/**
 * SRTM elevation data: download HGT tiles and look up elevation for any lat/lon.
 * Uses SRTM1 (1-arc-second, ~30m resolution) data from NASA/USGS.
 * HGT files are 3601x3601 grids of big-endian Int16 elevation values.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRTM_DIR = join(__dirname, "..", "data", "srtm");
const SRTM_SIZE = 3601; // 1-arc-second = 3601 samples per degree
const VOID = -32768;

// ESA Copernicus SRTM mirror (free, no auth)
const HGT_URLS: Record<string, string> = {
  "N47E008": "https://step.esa.int/auxdata/dem/SRTMGL1/N47E008.SRTMGL1.hgt.zip",
  "N47E009": "https://step.esa.int/auxdata/dem/SRTMGL1/N47E009.SRTMGL1.hgt.zip",
};

interface SrtmTile {
  lat: number;
  lon: number;
  data: Int16Array;
}

const tileCache = new Map<string, SrtmTile>();

function tileKey(lat: number, lon: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${latDir}${String(Math.abs(lat)).padStart(2, "0")}${lonDir}${String(Math.abs(lon)).padStart(3, "0")}`;
}

function parseBigEndianInt16(buffer: Buffer): Int16Array {
  const count = buffer.length / 2;
  const result = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = buffer.readInt16BE(i * 2);
  }
  return result;
}

async function downloadTile(key: string): Promise<void> {
  mkdirSync(SRTM_DIR, { recursive: true });
  const hgtPath = join(SRTM_DIR, `${key}.hgt`);

  if (existsSync(hgtPath)) {
    const stat = readFileSync(hgtPath);
    if (stat.length === SRTM_SIZE * SRTM_SIZE * 2) return; // valid
  }

  const url = HGT_URLS[key];
  if (!url) {
    throw new Error(`No download URL for SRTM tile ${key}`);
  }

  console.log(`  Downloading SRTM tile ${key}...`);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to download ${key}: ${resp.status}`);
  }

  const zipBuffer = Buffer.from(await resp.arrayBuffer());

  // Simple ZIP extraction: find the .hgt file in the zip
  // ZIP local file header starts with PK\x03\x04
  // We look for the .hgt entry and extract its uncompressed data
  const hgtData = extractHgtFromZip(zipBuffer, key);
  if (!hgtData) {
    throw new Error(`Could not find ${key}.hgt in downloaded zip`);
  }

  writeFileSync(hgtPath, hgtData);
  console.log(`  Saved ${key}.hgt (${(hgtData.length / 1024 / 1024).toFixed(1)}MB)`);
}

function extractHgtFromZip(zip: Buffer, key: string): Buffer | null {
  // Minimal ZIP parser: find the file and extract if stored (no compression)
  // SRTM zips typically use DEFLATE, so we need to handle that too
  // For simplicity, use Node.js zlib for DEFLATE
  const { inflateRawSync } = require("zlib") as typeof import("zlib");

  let offset = 0;
  while (offset < zip.length - 4) {
    // Look for local file header signature PK\x03\x04
    if (zip[offset] !== 0x50 || zip[offset + 1] !== 0x4b ||
        zip[offset + 2] !== 0x03 || zip[offset + 3] !== 0x04) {
      offset++;
      continue;
    }

    const compressionMethod = zip.readUInt16LE(offset + 8);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const uncompressedSize = zip.readUInt32LE(offset + 22);
    const nameLen = zip.readUInt16LE(offset + 26);
    const extraLen = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + nameLen).toString("utf-8");
    const dataStart = offset + 30 + nameLen + extraLen;

    if (name.endsWith(".hgt")) {
      const compressed = zip.subarray(dataStart, dataStart + compressedSize);
      if (compressionMethod === 0) {
        // Stored
        return Buffer.from(compressed);
      } else if (compressionMethod === 8) {
        // DEFLATE
        return Buffer.from(inflateRawSync(compressed));
      }
    }

    offset = dataStart + compressedSize;
  }

  return null;
}

function loadTile(key: string): SrtmTile | null {
  if (tileCache.has(key)) return tileCache.get(key)!;

  const hgtPath = join(SRTM_DIR, `${key}.hgt`);
  if (!existsSync(hgtPath)) return null;

  const buffer = readFileSync(hgtPath);
  const expectedSize = SRTM_SIZE * SRTM_SIZE * 2;
  if (buffer.length !== expectedSize) {
    console.warn(`  SRTM tile ${key} has wrong size: ${buffer.length} (expected ${expectedSize})`);
    return null;
  }

  const lat = parseInt(key.slice(1, 3)) * (key[0] === "N" ? 1 : -1);
  const lon = parseInt(key.slice(4, 7)) * (key[3] === "E" ? 1 : -1);

  const tile: SrtmTile = {
    lat,
    lon,
    data: parseBigEndianInt16(buffer),
  };

  tileCache.set(key, tile);
  return tile;
}

/**
 * Get elevation at a lat/lon point using bilinear interpolation.
 * Returns elevation in meters, or null if data is void.
 */
export function getElevation(lat: number, lon: number): number | null {
  const tileLat = Math.floor(lat);
  const tileLon = Math.floor(lon);
  const key = tileKey(tileLat, tileLon);
  const tile = loadTile(key);
  if (!tile) return null;

  // Row: 0 = north edge (tileLat + 1), 3600 = south edge (tileLat)
  const rowF = (tileLat + 1 - lat) * (SRTM_SIZE - 1);
  const colF = (lon - tileLon) * (SRTM_SIZE - 1);

  const row = Math.floor(rowF);
  const col = Math.floor(colF);
  const rowFrac = rowF - row;
  const colFrac = colF - col;

  // Bilinear interpolation of 4 surrounding cells
  const r0 = Math.min(row, SRTM_SIZE - 1);
  const r1 = Math.min(row + 1, SRTM_SIZE - 1);
  const c0 = Math.min(col, SRTM_SIZE - 1);
  const c1 = Math.min(col + 1, SRTM_SIZE - 1);

  const e00 = tile.data[r0 * SRTM_SIZE + c0];
  const e01 = tile.data[r0 * SRTM_SIZE + c1];
  const e10 = tile.data[r1 * SRTM_SIZE + c0];
  const e11 = tile.data[r1 * SRTM_SIZE + c1];

  // Handle void values
  if (e00 === VOID || e01 === VOID || e10 === VOID || e11 === VOID) {
    // Use nearest non-void value
    const values = [e00, e01, e10, e11].filter((v) => v !== VOID);
    return values.length > 0 ? values[0] : null;
  }

  const elev =
    e00 * (1 - rowFrac) * (1 - colFrac) +
    e01 * (1 - rowFrac) * colFrac +
    e10 * rowFrac * (1 - colFrac) +
    e11 * rowFrac * colFrac;

  return Math.round(elev * 10) / 10;
}

/**
 * Get elevations for an array of [lat, lon] points.
 * Much faster than individual lookups since the tile is cached.
 */
export function getElevations(coords: [number, number][]): number[] {
  return coords.map(([lat, lon]) => getElevation(lat, lon) ?? 0);
}

/**
 * Ensure required SRTM tiles are downloaded.
 */
export async function ensureSrtmTiles(requiredTiles: string[]): Promise<void> {
  for (const key of requiredTiles) {
    await downloadTile(key);
  }
  // Verify they load
  for (const key of requiredTiles) {
    const tile = loadTile(key);
    if (!tile) throw new Error(`Failed to load SRTM tile ${key} after download`);
    console.log(`  SRTM tile ${key} loaded: ${SRTM_SIZE}x${SRTM_SIZE} grid`);
  }
}
