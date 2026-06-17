import { fromArrayBuffer } from "geotiff";

export const SATELLITE_CHANNELS = [
  "IR_016",
  "IR_039",
  "IR_087",
  "IR_097",
  "IR_108",
  "IR_120",
  "IR_134",
  "VIS006",
  "VIS008",
  "WV_062",
  "WV_073"
] as const;
export type SatelliteChannel = (typeof SATELLITE_CHANNELS)[number];

export type TifLayerData = {
  imageDataUrl: string;
  bounds: [number, number, number, number];
};

const API_PREFIX = process.env.NEXT_PUBLIC_QUARTZ_API_URL || "https://api-dev.quartz.solar";

// --- double buffer slots ---
const SLOT_A = { layer: "satellite-layer-a", source: "satellite-source-a" };
const SLOT_B = { layer: "satellite-layer-b", source: "satellite-source-b" };
let activeSlot = SLOT_A;

async function getToken(): Promise<string> {
  const res = await fetch("/api/get_token");
  if (!res.ok) throw new Error("Failed to get auth token");
  const data = await res.json();
  return data.accessToken as string;
}

export async function fetchSatelliteTif(
  channel: SatelliteChannel,
  timestamp: string
): Promise<ArrayBuffer | null> {
  const token = await getToken();
  const apiUrl = `${API_PREFIX}/satellite/?channel=${encodeURIComponent(
    channel
  )}&timestamp=${encodeURIComponent(timestamp)}`;

  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    const apiRes = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (apiRes.status === 429) {
      attempt++;
      if (attempt >= maxRetries) {
        throw new Error("Satellite API rate limited: max retries reached (429)");
      }
      // Retry after 1.2 to 1.5 seconds (1.some fraction seconds)
      const delayMs = 1200 + Math.random() * 300;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    if (apiRes.status === 404) return null;
    if (!apiRes.ok) throw new Error(`Satellite API error: ${apiRes.status}`);

    const contentType = apiRes.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const { url } = await apiRes.json();
      const s3Res = await fetch(url);
      if (!s3Res.ok) throw new Error(`S3 fetch failed: ${s3Res.status}`);
      return s3Res.arrayBuffer();
    }
    return apiRes.arrayBuffer();
  }
  return null;
}

function mercToWgs84(x: number, y: number): [number, number] {
  const lon = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360) / Math.PI - 90;
  return [lon, lat];
}

export async function decodeTif(buf: ArrayBuffer): Promise<TifLayerData> {
  const tiff = await fromArrayBuffer(buf);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const data = await image.readRasters();
  const [minX, minY, maxX, maxY] = image.getBoundingBox();
  const [minLon, minLat] = mercToWgs84(minX, minY);
  const [maxLon, maxLat] = mercToWgs84(maxX, maxY);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(width, height);
  const px = imageData.data;

  const bands = Array.isArray(data) ? data : [data];
  const band = bands[0] as Float32Array | Uint16Array | Uint8Array;

  let minVal = Infinity,
    maxVal = -Infinity;
  for (let i = 0; i < band.length; i++) {
    const v = band[i];
    if (isFinite(v)) {
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }
  if (!isFinite(minVal)) {
    minVal = 0;
    maxVal = 1;
  }
  const range = maxVal - minVal || 1;

  for (let i = 0; i < band.length; i++) {
    const pi = i * 4;
    const v = band[i];
    if (isFinite(v)) {
      const g = Math.max(0, Math.min(255, ((v - minVal) / range) * 255));
      px[pi] = g;
      px[pi + 1] = g;
      px[pi + 2] = g;
      px[pi + 3] = 180;
    } else {
      px[pi] = px[pi + 1] = px[pi + 2] = px[pi + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return { imageDataUrl: canvas.toDataURL(), bounds: [minLon, minLat, maxLon, maxLat] };
}

export async function fetchAndDecodeSatelliteTif(
  channel: SatelliteChannel,
  timestamp: string
): Promise<TifLayerData | null> {
  const buf = await fetchSatelliteTif(channel, timestamp);
  if (!buf) return null;
  return decodeTif(buf);
}

export function applyTifLayerToMap(
  map: mapboxgl.Map,
  layerData: TifLayerData | null,
  _layerId: string,
  _sourceId: string,
  isVisible = true
): void {
  if (!layerData) {
    setSatelliteLayerVisibility(map, false, _layerId);
    return;
  }
  const {
    imageDataUrl,
    bounds: [minLon, minLat, maxLon, maxLat]
  } = layerData;
  const coords: [[number, number], [number, number], [number, number], [number, number]] = [
    [minLon, maxLat],
    [maxLon, maxLat],
    [maxLon, minLat],
    [minLon, minLat]
  ];

  const next = activeSlot === SLOT_A ? SLOT_B : SLOT_A;
  const prev = activeSlot;

  // load into the inactive slot
  const existingSource = map.getSource(next.source) as mapboxgl.ImageSource | undefined;
  if (existingSource) {
    existingSource.updateImage({ url: imageDataUrl, coordinates: coords });
  } else {
    map.addSource(next.source, { type: "image", url: imageDataUrl, coordinates: coords });
  }

  if (!map.getLayer(next.layer)) {
    map.addLayer({
      id: next.layer,
      type: "raster",
      source: next.source,
      paint: {
        "raster-opacity": 0,
        "raster-opacity-transition": { duration: 0 }
      }
    });
  }

  // once the new image is loaded, crossfade
  map.once("idle", () => {
    if (!map.getLayer(next.layer)) return;

    map.setPaintProperty(next.layer, "raster-opacity-transition", { duration: 300 });
    map.setPaintProperty(next.layer, "raster-opacity", isVisible ? 0.6 : 0);

    if (map.getLayer(prev.layer)) {
      map.setPaintProperty(prev.layer, "raster-opacity-transition", { duration: 300 });
      map.setPaintProperty(prev.layer, "raster-opacity", 0);
    }

    activeSlot = next;
  });
}

export function setSatelliteLayerVisibility(
  map: mapboxgl.Map,
  isVisible: boolean,
  _layerId: string
): void {
  for (const slot of [SLOT_A, SLOT_B]) {
    if (map.getLayer(slot.layer)) {
      map.setPaintProperty(slot.layer, "raster-opacity", isVisible ? 0.6 : 0);
    }
  }
}
