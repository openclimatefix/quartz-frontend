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

// SEVIRI channels grouped by how they sense. IR_016 (1.6um) is near-IR and
// *reflective* despite the "IR_" prefix, so it groups with the visible ones.
//
// STACK ORDER: every list here is ordered **bottom-most first** — the last entry
// renders on top. This matters a lot, because each layer only contributes about
// 0.42 effective alpha (texture alpha 180/255 x raster-opacity 0.6), so five
// layers above something leave only (1-0.42)^5 ~= 7% of it visible. Anything
// buried is effectively gone, and the stack averages out to flat grey. So the
// crisp, high-contrast bands go last, and the flat ones go underneath.
export const REFLECTIVE_CHANNELS: SatelliteChannel[] = [
  "IR_016", // near-IR, useful for ice/water cloud discrimination
  "VIS008",
  "VIS006" // the classic visible band, most interpretable — keep it on top
];

// The "true" emissive IR channels. The API already inverts these before saving,
// so they arrive with cold cloud tops bright and need no client-side flip.
export const THERMAL_CHANNELS: SatelliteChannel[] = [
  "IR_134",
  "IR_097",
  "IR_120",
  "IR_087",
  "IR_108" // the standard atmospheric window channel, most informative thermal
];

// Also emissive, and likewise already inverted API-side.
export const WATER_VAPOUR_CHANNELS: SatelliteChannel[] = ["WV_073", "WV_062"];

// IR_039 (3.9um) carries both reflected solar and emitted thermal signal, so the
// two partly cancel in daylight. That makes it washed out, and makes its polarity
// behave unlike the true IR channels the API inverts. Its genuine uses (night fog
// / low cloud via the 3.9-10.8 difference, hotspot detection) aren't served by a
// brightness composite, so it stays out of the composites and is offered only as
// a single channel.
export const MIXED_CHANNELS: SatelliteChannel[] = ["IR_039"];

// Only IR_039 needs a client-side flip, to line it up with the API-inverted
// channels when viewed on its own.
//
// TEMPORARY: this belongs in the API, done client-side only to try the composites.
const INVERTED_CHANNELS: SatelliteChannel[] = [...MIXED_CHANNELS];

export const shouldInvertChannel = (ch: SatelliteChannel): boolean =>
  INVERTED_CHANNELS.includes(ch);

// Selections that overlay several same-family channels into one combined view.
// Keys are stored in global state, so renaming one invalidates a user's saved
// selection — labels are free to change, keys are not. (A full visible+IR
// composite was tried and dropped: greyscale-averaging reflective and thermal
// bands muddied both and lost the per-band nuance, for little gain in a
// daytime-centric solar app.)
//
// Labels name the bands they stack, matching how the single channels below are
// listed. "Blue" was the odd one out — it described neither the instrument nor
// the output, so it reads as Water Vapour instead.
export const COMPOSITE_SELECTIONS = {
  COMPOSITE_VISIBLE: { label: "Visible Composite", channels: REFLECTIVE_CHANNELS },
  COMPOSITE_INFRARED: { label: "Infrared Composite", channels: THERMAL_CHANNELS },
  COMPOSITE_BLUE: { label: "Water Vapour Composite", channels: WATER_VAPOUR_CHANNELS }
};

export type CompositeSelection = keyof typeof COMPOSITE_SELECTIONS;
export type ChannelSelection = SatelliteChannel | CompositeSelection;

// Default selection: the visible composite — the most legible view in daylight,
// the hours that matter for solar. (It is dark at night, when the reflective
// bands see no sunlight; acceptable since generation is zero then.)
export const DEFAULT_CHANNEL_SELECTION: CompositeSelection = "COMPOSITE_VISIBLE";

// Resolve a dropdown selection to the actual channels to render.
export const channelsForSelection = (sel: ChannelSelection): SatelliteChannel[] =>
  sel in COMPOSITE_SELECTIONS
    ? COMPOSITE_SELECTIONS[sel as CompositeSelection].channels
    : [sel as SatelliteChannel];

// Widest composite, used to size the tif cache so a full selection still fits.
export const MAX_COMPOSITE_CHANNELS = Math.max(
  ...Object.values(COMPOSITE_SELECTIONS).map((c) => c.channels.length)
);

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

// One layer/source per channel, so a composite can stack them. Kept here rather
// than in map.tsx so the ids have a single home.
export const satLayerId = (ch: SatelliteChannel) => `satellite-layer-${ch}`;
export const satSourceId = (ch: SatelliteChannel) => `satellite-source-${ch}`;

const SAT_OPACITY = 0.6;
const SAT_TEXTURE_SIZE = 512;
// Alpha of the brightest pixel in a decoded texture. Everything darker scales
// down from here, so the effective ceiling matches the old flat value.
const SAT_MAX_ALPHA = 180;
// Encoding for the cached texture. WebP is much smaller than PNG and preserves
// alpha; quality is a lossy/size trade — raise toward 1 if artefacts show. (Size
// is largely alpha-bound, and WebP stores alpha losslessly, so quality has little
// effect here — kept high for free colour fidelity.)
const SAT_IMAGE_TYPE = "image/webp";
const SAT_IMAGE_QUALITY = 0.9;

// Per-map, per-layer counter, so a slow texture swap can't clobber a newer one on
// the same layer. Must be per-layer: with a single counter, stacking N channels
// means only the last one applied would pass the token check.
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

// /api/get_token is an Auth0 session round-trip on the Next server, not a cheap
// read, and every channel fetch used to pay for its own. A composite with the
// +/-1 prefetch meant ~15 of them per timestep, each one sitting in front of its
// tif request. Share one token instead. The TTL is far shorter than the token's
// own lifetime, so this only collapses the burst — it can't serve a stale token.
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

  // Never cache a rejection: drop it so the next caller retries, rather than
  // replaying one failed auth call for the rest of the TTL. The caller still
  // sees this rejection — clearing the cache doesn't swallow it.
  const pending = tokenPromise;
  pending.catch(() => {
    if (tokenPromise === pending) tokenPromise = null;
  });

  return pending;
}

// Cap concurrent satellite requests. A composite fetches one tif per channel and
// the +/-1 prefetch triples that, so an uncapped selection can put ~15 requests
// in flight — enough to trip the API's rate limit and drop the whole batch into
// the 429 backoff path below, which is slower than simply queuing in the first
// place. The visible frame is always requested before the prefetches (see
// map.tsx), so it takes the slots first and can't be starved by speculative work.
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
  // Hand the slot directly to the next waiter rather than decrementing, so a
  // queued request can't have it stolen by a newly-arriving one.
  const next = waitingForSlot.shift();
  if (next) next();
  else activeRequests--;
}

export async function fetchSatelliteTif(
  channel: SatelliteChannel,
  timestamp: string,
  latest = false
): Promise<ArrayBuffer | null> {
  // The slot is held across the 429 retries too: a rate limit means the API is
  // already saturated, so keeping the queue closed is the useful backpressure.
  await acquireRequestSlot();
  try {
    return await requestSatelliteTif(channel, timestamp, latest);
  } finally {
    releaseRequestSlot();
  }
}

async function requestSatelliteTif(
  channel: SatelliteChannel,
  timestamp: string,
  latest: boolean
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

export async function decodeTif(buf: ArrayBuffer, invert = false): Promise<TifLayerData> {
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
      const stretched = Math.max(0, Math.min(255, (v - minVal) * scale));
      const g = invert ? 255 - stretched : stretched;
      px[pi] = g;
      px[pi + 1] = g;
      px[pi + 2] = g;
      // Alpha tracks brightness rather than being flat, which turns a stack from
      // "average everything" into roughly "brightest wins": bright cloud stays
      // opaque and dominates, while dark pixels (clear sky, and the whole visible
      // band at night) go transparent and let the layers beneath show through.
      // Scaled so the brightest pixel still tops out at the previous flat value.
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
  // WebP keeps the alpha channel (unlike JPEG) but compresses far better than the
  // default PNG (~4x smaller here), so each cached entry is a fraction of the size.
  // Falls back to the browser default if WebP isn't supported (a PNG data URL).
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
  return decodeTif(buf, shouldInvertChannel(channel));
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
        // Hidden layers use layout visibility rather than zero opacity: Mapbox
        // skips a "none" layer entirely, whereas an opacity-0 layer is still drawn
        // every frame — which matters once a composite stacks several of them.
        layout: { visibility: "none" },
        paint: {
          "raster-opacity": SAT_OPACITY,
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

// Show exactly the channels in `visible`, hiding every other satellite layer.
export function setVisibleSatelliteChannels(map: mapboxgl.Map, visible: SatelliteChannel[]): void {
  const visibleSet = new Set(visible);
  SATELLITE_CHANNELS.forEach((ch) => setSatelliteLayerVisibility(map, visibleSet.has(ch), ch));
}

// Restack the given channels, bottom-most first. Layers are created lazily — the
// first time a composite containing them is selected — so creation order depends
// on which selections the user happened to visit and can't be relied on. Moving
// each layer in turn to just below the anchor reproduces the intended order
// exactly, whatever the history. Cheap: a style reorder over at most a few layers.
export function orderSatelliteLayers(
  map: mapboxgl.Map,
  channels: SatelliteChannel[],
  beforeId?: string
): void {
  // A missing anchor means "move to the top of the stack", which still gives the
  // right relative order when iterating bottom-most first.
  const anchor = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
  channels.forEach((ch) => {
    const layerId = satLayerId(ch);
    if (map.getLayer(layerId)) map.moveLayer(layerId, anchor);
  });
}
