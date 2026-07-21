import { fromArrayBuffer } from "geotiff";

export const SATELLITE_CHANNELS = [
  "VIS006",
  "VIS008",
  "IR_016",
  "IR_039",
  "IR_087",
  "IR_097",
  "IR_108",
  "IR_120",
  "IR_134",
  "WV_062",
  "WV_073"
] as const;
export type SatelliteChannel = (typeof SATELLITE_CHANNELS)[number];

export const SATELLITE_CHANNEL_LABELS: Record<SatelliteChannel, string> = {
  VIS006: "Visible 0.6µm",
  VIS008: "Visible 0.8µm",
  IR_016: "Near-IR 1.6µm",
  IR_039: "Infrared 3.9µm",
  IR_087: "Infrared 8.7µm",
  IR_097: "Infrared 9.7µm",
  IR_108: "Infrared 10.8µm",
  IR_120: "Infrared 12.0µm",
  IR_134: "Infrared 13.4µm",
  WV_062: "Water Vapour 6.2µm",
  WV_073: "Water Vapour 7.3µm"
};

export type TifLayerData = {
  imageDataUrl: string;
  bounds: [number, number, number, number];
};

const API_PREFIX =
  process.env.NEXT_PUBLIC_API_PREFIX?.replace("/v0", "") || "https://api-dev.quartz.solar";

const SAT_LAYER = "satellite-layer";
const SAT_SOURCE = "satellite-source";
const SAT_OPACITY = 0.6;
const SAT_TEXTURE_SIZE = 512;
const swapTokenByMap = new WeakMap<mapboxgl.Map, number>();
const MERCATOR_MAX = 20037508.34;

function mercToWgs84(x: number, y: number): [number, number] {
  const lon = (x / MERCATOR_MAX) * 180;
  const lat = (Math.atan(Math.exp((y / MERCATOR_MAX) * Math.PI)) * 360) / Math.PI - 90;
  return [lon, lat];
}

async function getToken(): Promise<string> {
  const res = await fetch("/api/get_token");
  if (!res.ok) throw new Error("Failed to get auth token");
  const data = await res.json();
  return data.accessToken as string;
}

export async function fetchSatelliteTif(
  channel: SatelliteChannel,
  timestamp: string,
  latest = false
): Promise<ArrayBuffer | null> {
  const token = await getToken();
  const apiUrl = `${API_PREFIX}/satellite/?channel=${encodeURIComponent(
    channel
  )}&timestamp=${encodeURIComponent(timestamp)}${latest ? "&latest=true" : ""}`;

  const maxRetries = 5;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiRes = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (apiRes.status === 429) {
      if (attempt === maxRetries - 1) {
        throw new Error("Satellite API rate limited: max retries reached (429)");
      }
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
      if (s3Res.status === 404) return null;
      if (!s3Res.ok) throw new Error(`S3 fetch failed: ${s3Res.status}`);
      return s3Res.arrayBuffer();
    }
    return apiRes.arrayBuffer();
  }
  return null;
}

export async function decodeTif(buf: ArrayBuffer): Promise<TifLayerData> {
  const tiff = await fromArrayBuffer(buf);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const data = await image.readRasters();
  let minLon: number, minLat: number, maxLon: number, maxLat: number;
  const meta = (await image.getGDALMetadata()) as { bounds_wgs84?: string } | null;
  const tag = meta?.bounds_wgs84?.split(",").map(Number);
  if (tag && tag.length === 4 && tag.every((n) => isFinite(n))) {
    [minLon, minLat, maxLon, maxLat] = tag as [number, number, number, number];
  } else {
    const [minX, minY, maxX, maxY] = image.getBoundingBox();
    [minLon, minLat] = mercToWgs84(minX, minY);
    [maxLon, maxLat] = mercToWgs84(maxX, maxY);
  }

  const bands = Array.isArray(data) ? data : [data];
  const band = bands[0] as Float32Array | Uint16Array | Uint8Array;

  let minVal = Infinity;
  let maxVal = -Infinity;
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
  const scale = 255 / range;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(width, height);
  const px = imageData.data;

  for (let i = 0; i < band.length; i++) {
    const pi = i * 4;
    const v = band[i];
    if (isFinite(v)) {
      const g = Math.max(0, Math.min(255, (v - minVal) * scale));
      px[pi] = g;
      px[pi + 1] = g;
      px[pi + 2] = g;
      px[pi + 3] = 180;
    } else {
      px[pi] = px[pi + 1] = px[pi + 2] = px[pi + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const outCanvas = document.createElement("canvas");
  outCanvas.width = SAT_TEXTURE_SIZE;
  outCanvas.height = SAT_TEXTURE_SIZE;
  const outCtx = outCanvas.getContext("2d")!;
  outCtx.drawImage(canvas, 0, 0, width, height, 0, 0, SAT_TEXTURE_SIZE, SAT_TEXTURE_SIZE);
  return { imageDataUrl: outCanvas.toDataURL(), bounds: [minLon, minLat, maxLon, maxLat] };
}

export async function fetchAndDecodeSatelliteTif(
  channel: SatelliteChannel,
  timestamp: string,
  latest = false
): Promise<TifLayerData | null> {
  const buf = await fetchSatelliteTif(channel, timestamp, latest);
  if (!buf) return null;
  return decodeTif(buf);
}

export function applyTifLayerToMap(
  map: mapboxgl.Map,
  layerData: TifLayerData | null,
  isVisible = true
): void {
  if (!layerData) {
    setSatelliteLayerVisibility(map, false);
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

  const token = (swapTokenByMap.get(map) ?? 0) + 1;
  swapTokenByMap.set(map, token);

  const existingSource = map.getSource(SAT_SOURCE) as mapboxgl.ImageSource | undefined;
  if (existingSource) {
    existingSource.updateImage({ url: imageDataUrl, coordinates: coords });
  } else {
    map.addSource(SAT_SOURCE, { type: "image", url: imageDataUrl, coordinates: coords });
  }

  if (!map.getLayer(SAT_LAYER)) {
    map.addLayer({
      id: SAT_LAYER,
      type: "raster",
      source: SAT_SOURCE,
      paint: {
        "raster-opacity": 0,
        "raster-opacity-transition": { duration: 0 },
        // Disable the cross-fade between old and new textures.
        "raster-fade-duration": 0
      }
    });
  }

  if (swapTokenByMap.get(map) === token) {
    map.setPaintProperty(SAT_LAYER, "raster-opacity", isVisible ? SAT_OPACITY : 0);
  }
}

export function setSatelliteLayerVisibility(map: mapboxgl.Map, isVisible: boolean): void {
  if (map.getLayer(SAT_LAYER)) {
    map.setPaintProperty(SAT_LAYER, "raster-opacity", isVisible ? SAT_OPACITY : 0);
  }
}
