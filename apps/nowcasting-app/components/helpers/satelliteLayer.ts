import { fromArrayBuffer } from "geotiff";

export const SATELLITE_CHANNELS = [
  "COMPOSITE_VISIBLE",
  "COMPOSITE_INFRARED",
  "COMPOSITE_BLUE",
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

export const isCompositeChannel = (ch: SatelliteChannel): boolean => ch.startsWith("COMPOSITE_");

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
  WV_073: "Water Vapour 7.3µm",
  COMPOSITE_VISIBLE: "Visible Composite",
  COMPOSITE_INFRARED: "Infrared Composite",
  COMPOSITE_BLUE: "Water Vapour Composite" // API's "Blue" channel is water vapour
};

export type TifLayerData = {
  imageDataUrl: string;
  bounds: [number, number, number, number];
};

const API_PREFIX =
  process.env.NEXT_PUBLIC_API_PREFIX?.replace("/v0", "") || "https://api-dev.quartz.solar";

export const satLayerId = (ch: SatelliteChannel) => `satellite-layer-${ch}`;
export const satSourceId = (ch: SatelliteChannel) => `satellite-source-${ch}`;

const SAT_OPACITY = 0.6;
const SAT_TEXTURE_SIZE = 512;
// Ceiling alpha for the brightest pixel; darker pixels scale down from here.
const SAT_MAX_ALPHA = 180;
const SAT_IMAGE_TYPE = "image/webp"; // smaller than PNG, keeps alpha
const SAT_IMAGE_QUALITY = 0.9;

// Per-layer counter so a slow texture swap can't clobber a newer one.
const swapTokenByMap = new WeakMap<mapboxgl.Map, Map<string, number>>();

function nextSwapToken(map: mapboxgl.Map, layerId: string): number {
  let tokens = swapTokenByMap.get(map);
  if (!tokens) {
    tokens = new Map();
    swapTokenByMap.set(map, tokens);
  }
  const token = (tokens.get(layerId) ?? 0) + 1;
  tokens.set(layerId, token);
  return token;
}

function currentSwapToken(map: mapboxgl.Map, layerId: string): number {
  return swapTokenByMap.get(map)?.get(layerId) ?? 0;
}
const MERCATOR_MAX = 20037508.34;

function mercToWgs84(x: number, y: number): [number, number] {
  const lon = (x / MERCATOR_MAX) * 180;
  const lat = (Math.atan(Math.exp((y / MERCATOR_MAX) * Math.PI)) * 360) / Math.PI - 90;
  return [lon, lat];
}

// Share one auth token across concurrent fetches instead of round-tripping per request.
const TOKEN_TTL_MS = 60_000;
let tokenPromise: Promise<string> | null = null;
let tokenFetchedAt = 0;

async function getToken(): Promise<string> {
  if (tokenPromise && Date.now() - tokenFetchedAt < TOKEN_TTL_MS) return tokenPromise;

  tokenFetchedAt = Date.now();
  tokenPromise = (async () => {
    const res = await fetch("/api/get_token");
    if (!res.ok) throw new Error("Failed to get auth token");
    const data = await res.json();
    return data.accessToken as string;
  })();

  // Never cache a rejection, so the next caller retries instead of reusing it.
  const pending = tokenPromise;
  pending.catch(() => {
    if (tokenPromise === pending) tokenPromise = null;
  });

  return pending;
}

// Cap concurrent requests so scrubbing quickly doesn't trip the API's rate limit.
const MAX_CONCURRENT_SAT_REQUESTS = 4;

let activeRequests = 0;
const waitingForSlot: (() => void)[] = [];

function acquireRequestSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_SAT_REQUESTS) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waitingForSlot.push(resolve));
}

function releaseRequestSlot(): void {
  // Hand the slot directly to the next waiter so it can't be stolen.
  const next = waitingForSlot.shift();
  if (next) next();
  else activeRequests--;
}

export async function fetchSatelliteTif(
  channel: SatelliteChannel,
  timestamp: string,
  latest = false
): Promise<ArrayBuffer | null> {
  // Held across 429 retries too — that's the useful backpressure.
  await acquireRequestSlot();
  try {
    return await requestSatelliteTif(channel, timestamp, latest);
  } finally {
    releaseRequestSlot();
  }
}

// Presigned URLs warmed from GET /satellite/history, keyed by `channel|timestamp`.
const presignedUrlCache = new Map<string, string>();

// Warm the cache for `channel` between startISO and endISO in one request.
export async function warmPresignedUrlHistory(
  channel: SatelliteChannel,
  startISO: string,
  endISO: string
): Promise<void> {
  const token = await getToken();
  const url = `${API_PREFIX}/satellite/history?channel=${encodeURIComponent(
    channel
  )}&start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return;
  const entries: { timestamp: string; url: string }[] = await res.json();
  // Normalise to "Z"-suffixed ISO to match keys used elsewhere.
  entries.forEach((e) =>
    presignedUrlCache.set(`${channel}|${new Date(e.timestamp).toISOString()}`, e.url)
  );
}

async function requestSatelliteTif(
  channel: SatelliteChannel,
  timestamp: string,
  latest: boolean
): Promise<ArrayBuffer | null> {
  const cacheKey = `${channel}|${timestamp}`;
  const cachedUrl = !latest ? presignedUrlCache.get(cacheKey) : undefined;
  if (cachedUrl) {
    const s3Res = await fetch(cachedUrl);
    if (s3Res.ok) return s3Res.arrayBuffer();
    if (s3Res.status === 404) return null;
    // Stale despite being warmed — drop it and fall through to a fresh request.
    presignedUrlCache.delete(cacheKey);
  }

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
      if (!latest) presignedUrlCache.set(cacheKey, url);
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
      // Alpha tracks brightness: dark pixels go transparent, bright cloud stays opaque.
      px[pi + 3] = (g * SAT_MAX_ALPHA) / 255;
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
  // WebP: keeps alpha, ~4x smaller than PNG.
  const imageDataUrl = outCanvas.toDataURL(SAT_IMAGE_TYPE, SAT_IMAGE_QUALITY);
  return { imageDataUrl, bounds: [minLon, minLat, maxLon, maxLat] };
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
  channel: SatelliteChannel,
  isVisible = true,
  beforeId?: string
): void {
  const layerId = satLayerId(channel);
  const sourceId = satSourceId(channel);

  if (!layerData) {
    setSatelliteLayerVisibility(map, false, channel);
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

  const token = nextSwapToken(map, layerId);

  const existingSource = map.getSource(sourceId) as mapboxgl.ImageSource | undefined;
  if (existingSource) {
    existingSource.updateImage({ url: imageDataUrl, coordinates: coords });
  } else {
    map.addSource(sourceId, { type: "image", url: imageDataUrl, coordinates: coords });
  }

  if (!map.getLayer(layerId)) {
    map.addLayer(
      {
        id: layerId,
        type: "raster",
        source: sourceId,
        // Layout visibility, not zero opacity: Mapbox skips a "none" layer entirely.
        layout: { visibility: "none" },
        paint: {
          "raster-opacity": isCompositeChannel(channel) ? 0.9 : SAT_OPACITY,
          "raster-opacity-transition": { duration: 0 },
          // Disable the cross-fade between old and new textures.
          "raster-fade-duration": 0
        }
      },
      // Insert beneath the forecast/PV layers so clouds sit under them.
      beforeId && map.getLayer(beforeId) ? beforeId : undefined
    );
  }

  if (currentSwapToken(map, layerId) === token) {
    setSatelliteLayerVisibility(map, isVisible, channel);
  }
}

export function setSatelliteLayerVisibility(
  map: mapboxgl.Map,
  isVisible: boolean,
  channel: SatelliteChannel
): void {
  const layerId = satLayerId(channel);
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, "visibility", isVisible ? "visible" : "none");
  }
}

// Show exactly `channel`, hiding the rest. Pass undefined to hide all.
export function setVisibleSatelliteChannels(map: mapboxgl.Map, channel?: SatelliteChannel): void {
  SATELLITE_CHANNELS.forEach((ch) => setSatelliteLayerVisibility(map, ch === channel, ch));
}
