import type { UserState } from "../../data/types";

const SHEET_TITLE = "40-lakes-state";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

// Find or create the spreadsheet
async function getOrCreateSheet(token: string): Promise<string> {
  // Search for existing sheet
  const searchRes = await fetch(
    `${DRIVE_API}?q=name='${SHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  // Create new spreadsheet
  const createRes = await fetch(SHEETS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title: SHEET_TITLE },
      sheets: [{ properties: { title: "state" } }],
    }),
  });
  const createData = await createRes.json();
  return createData.spreadsheetId;
}

export async function loadFromSheets(token: string): Promise<UserState | null> {
  try {
    const sheetId = await getOrCreateSheet(token);
    const res = await fetch(
      `${SHEETS_API}/${sheetId}/values/state!A1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    const raw = data.values?.[0]?.[0];
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed?.selectedLakeIds) &&
      Array.isArray(parsed?.completedSwims) &&
      typeof parsed?.goalCount === "number"
    ) {
      return parsed as UserState;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveToSheets(token: string, state: UserState): Promise<boolean> {
  try {
    const sheetId = await getOrCreateSheet(token);
    const json = JSON.stringify(state);
    const res = await fetch(
      `${SHEETS_API}/${sheetId}/values/state!A1?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          range: "state!A1",
          values: [[json]],
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
