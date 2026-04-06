// Switzerland bounding box (from GeoJSON border data)
const CH_LAT_MIN = 45.82;
const CH_LAT_MAX = 47.80;
const CH_LON_MIN = 5.96;
const CH_LON_MAX = 10.49;

// Accurate Switzerland outline derived from GeoJSON border coordinates
// Mapped to a 200x130 SVG viewBox (4px padding)
const CH_OUTLINE =
  "M114.2,4.0 L111.4,13.8 L116.4,13.7 L110.2,17.5 L100.1,16.2 L90.2,19.2 " +
  "L80.0,19.8 L77.3,18.2 L72.9,18.0 L70.0,21.6 L66.3,25.2 L56.2,23.4 " +
  "L48.2,25.4 L47.2,31.2 L48.8,34.0 L43.0,41.1 L35.2,51.2 L24.5,63.8 " +
  "L20.0,71.4 L8.9,86.3 L12.7,92.0 L10.7,96.9 L7.2,100.3 L4.9,104.9 " +
  "L7.8,106.3 L14.1,103.7 L18.6,99.3 L16.5,97.1 L38.4,93.1 L41.0,100.6 " +
  "L43.2,109.1 L47.5,114.6 L52.6,123.6 L61.6,120.1 L71.1,117.6 L79.9,118.7 " +
  "L86.7,115.1 L97.4,104.0 L101.6,92.8 L109.7,88.4 L109.1,99.5 L116.4,106.9 " +
  "L124.6,108.8 L128.3,119.1 L134.5,124.4 L132.4,116.8 L139.4,105.0 " +
  "L144.9,95.8 L150.8,84.5 L163.3,95.0 L175.0,95.7 L180.6,91.7 L179.3,77.8 " +
  "L190.1,80.7 L193.0,66.2 L179.4,63.0 L158.5,49.7 L155.6,49.4 L152.9,50.1 " +
  "L154.0,39.9 L158.5,24.5 L131.0,12.7 L125.3,9.3 L124.0,11.9 L117.2,6.7 " +
  "L114.2,4.0 Z";

interface Props {
  lat: number;
  lon: number;
}

export function MiniMap({ lat, lon }: Props) {
  const x = ((lon - CH_LON_MIN) / (CH_LON_MAX - CH_LON_MIN)) * 192 + 4;
  const y = ((CH_LAT_MAX - lat) / (CH_LAT_MAX - CH_LAT_MIN)) * 122 + 4;

  return (
    <svg viewBox="0 0 200 130" width="72" height="47" style={{ flexShrink: 0 }}>
      <path
        d={CH_OUTLINE}
        fill="#e8f4ec"
        stroke="#2d5a3d"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <circle cx={x} cy={y} r="6" fill="#e74c3c" stroke="white" stroke-width="2" />
    </svg>
  );
}
