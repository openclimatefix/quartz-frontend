import { fromArrayBuffer, GeoTIFFImage } from "geotiff";
import { getAccessToken } from "../../lib/api/auth/token";
import type { Scope } from "../../lib/domain/types";

// Phase 5 asks every peripheral to carry a Scope so a later endpoint swap is a change to one
// URL-building function, not a hunt through every caller. `map.tsx`'s calls into this module
// predate that and aren't updated to pass one — the default below is exactly what they get
// implicitly today, so behaviour is unchanged.
//
// **The scope does not reach the request, and that is not an oversight.** `requestSatelliteTif`
// sends a channel and a timestamp and nothing else: there is no country or bbox parameter, and
// the drawn extent comes from the GeoTIFF's own `bounds_wgs84` metadata (see below). So this
// module renders whatever the API serves and **is not GB-only** — an earlier version of this
// comment said it was, and was wrong.
//
// What that means in practice: **coverage is an API-side crop.** Extending to a new country is a
// change over there, not here, and it is invisible from this side until a region simply has no
// imagery over it. Known live item: the crop needs extending before Germany goes live.
export const DEFAULT_SATELLITE_SCOPE: Scope = {
  country: "GB",
  source: "solar",
  regionType: "national"
};

// The individual SEVIRI bands the API serves, one single-band tif per channel.
export const SATELLITE_BANDS = [
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

// Composites are blended server-side (see quartz-api's satellite service) and served
// as one single-band tif on the same route, so to this frontend they are ordinary
// channel keys: one fetch, one layer, decoded exactly like a band. The member channels
// and the alpha/opacity blend all live in the API now — nothing is stacked here.
export const SATELLITE_COMPOSITES = [
  "COMPOSITE_VISIBLE",
  "COMPOSITE_INFRARED",
  "COMPOSITE_BLUE"
] as const;

// Everything the `/satellite/` route accepts as `channel`.
export const SATELLITE_CHANNELS = [...SATELLITE_BANDS, ...SATELLITE_COMPOSITES] as const;
export type SatelliteChannel = (typeof SATELLITE_CHANNELS)[number];

// IR_016 (1.6um) is near-IR and *reflective* despite the "IR_" prefix. The "true"
// emissive IR and water-vapour channels are already inverted by the API before
// saving, so they arrive with cold cloud tops bright and need no client-side flip.
//
// IR_039 (3.9um) carries both reflected solar and emitted thermal signal, so the
// two partly cancel in daylight. That makes it washed out, and makes its polarity
// behave unlike the true IR channels the API inverts, so it is the one channel
// that needs a client-side flip to line up with the rest.
export const MIXED_CHANNELS: SatelliteChannel[] = ["IR_039"];

// Only IR_039 needs a client-side flip, to line it up with the API-inverted channels.
//
// TEMPORARY: this belongs in the API, done client-side only for now.
const INVERTED_CHANNELS: SatelliteChannel[] = [...MIXED_CHANNELS];

export const shouldInvertChannel = (ch: SatelliteChannel): boolean =>
  INVERTED_CHANNELS.includes(ch);

// The channel shown by default is COMPOSITE_VISIBLE, the most legible view in daylight —
// the hours that matter for solar. (It is dark at night, when the reflective bands see no
// sunlight; acceptable since generation is zero then.) The literal lives in globalState's
// initial state rather than being exported from here, so that module's import of this one
// can stay type-only — a value import would pull geotiff (ESM) into every test that loads
// global state.

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
  COMPOSITE_BLUE: "Water Vapour Composite"
};

export type TifLayerData = {
  imageDataUrl: string;
  bounds: [number, number, number, number];
  missingChannels?: string[];
};

// Satellite is on **neither v0 nor v1** — stripping `/v0` leaves the API root, so requests go to
// an unversioned `/satellite/` route. An earlier comment described this as "its v0 endpoint",
// which is wrong and matters: satellite is not waiting on a v1 migration, it sits outside the
// versioning scheme entirely. Whether that is a deliberate exemption or an oversight is a
// question for the API side, worth settling before EU satellite coverage is planned on top of it.
const API_PREFIX =
  process.env.NEXT_PUBLIC_API_PREFIX?.replace("/v0", "") || "https://api-dev.quartz.solar";

// One layer/source per channel. Kept here rather than in map.tsx so the ids have
// a single home.
export const satLayerId = (ch: SatelliteChannel) => `satellite-layer-${ch}`;
export const satSourceId = (ch: SatelliteChannel) => `satellite-source-${ch}`;

const SAT_LAYER_OPACITY = 0.8;
const SAT_RENDER_MAX_ALPHA = 255;

type ToneCurve = { gain: number; gamma: number };
const LINEAR_TONE: ToneCurve = { gain: 1, gamma: 1 };
const REFLECTIVE_TONE: ToneCurve = { gain: 1.6, gamma: 0.5 };
const REFLECTIVE_CHANNELS: SatelliteChannel[] = ["COMPOSITE_VISIBLE", "VIS006", "VIS008", "IR_016"];

const toneFor = (ch: SatelliteChannel): ToneCurve =>
  REFLECTIVE_CHANNELS.includes(ch) ? REFLECTIVE_TONE : LINEAR_TONE;

export const isCompositeChannel = (ch: SatelliteChannel): boolean =>
  (SATELLITE_COMPOSITES as readonly SatelliteChannel[]).includes(ch);

/**
 * Zooming *through* the clouds.
 *
 * SEVIRI resolves about 5 km per pixel over the UK. Web Mercator at 54°N is ~2,900 m/px at
 * zoom 5, so the imagery is already being upsampled ~1.7× at GB's default framing and about
 * 14× by zoom 8 — past a point it is not weather any more, it is large soft rectangles over
 * the regions you zoomed in to read.
 *
 * So the cloud layer fades out as you zoom in, over 6.5 → 8.
 *
 * **The start is pinned to NL's default framing zoom** (`config/countries.ts`), and that is the
 * binding constraint rather than a preference: NL frames at 6.5, so a band starting any lower
 * would have NL users land on a view that is already half faded. GB frames at 5 and has room to
 * spare. Sitting the start exactly on 6.5 means the ramp is still at full opacity there — the
 * fade begins on the first push in past it, which is what makes it noticeable.
 *
 * The end at 8 is inside the GSP band (7 → 8.5), so the cloud is gone while GSP boundaries are
 * still resolving rather than after they have. That ordering is the point (Brad, 2026-08-17):
 * you should watch a good number of GSPs come into clarity *as* the cloud goes, instead of the
 * cloud hanging around until it is one upsampled wisp over regions you are already reading.
 *
 * An earlier band was 7 → 8.5, exactly the GSP band. Tidier to describe and half a level too
 * late in practice.
 *
 * One shared band rather than a per-country one because the camera is shared: with both
 * countries enabled it frames their union, so "this country's framing zoom" is not a thing the
 * camera has. That is also why the NL floor applies to everyone.
 *
 * Two mechanisms, doing different jobs:
 *
 * - the `interpolate` on `["zoom"]` is what makes it a *fade*. It is evaluated per frame by the
 *   renderer, so it tracks a pinch or a scroll continuously — a JS zoom handler would only fire
 *   at the end of the gesture and land as a pop;
 * - `maxzoom` on the layer is what makes it *free*. Opacity 0 still costs a draw every frame,
 *   which is the same reasoning the visibility comment below records, so it is worth avoiding.
 *   Mapbox stops drawing a layer at or above its `maxzoom`, and since the ramp has already
 *   reached 0 at exactly that zoom, the cut is invisible.
 *
 * Adjusting the feel is these two numbers and nothing else.
 */
export const CLOUD_FADE_START_ZOOM = 6.5;
export const CLOUD_FADE_END_ZOOM = 8;

const satOpacityExpression = (channel: SatelliteChannel): mapboxgl.Expression => [
  "interpolate",
  ["linear"],
  ["zoom"],
  CLOUD_FADE_START_ZOOM,
  SAT_LAYER_OPACITY,
  CLOUD_FADE_END_ZOOM,
  0
];

// Alpha of the brightest pixel in a decoded texture. Everything darker scales
// down from here, so the effective ceiling matches the old flat value.
const SAT_MAX_ALPHA = 180;
// Encoding for the cached texture. WebP is much smaller than PNG and preserves
// alpha; quality is a lossy/size trade — raise toward 1 if artefacts show. (Size
// is largely alpha-bound, and WebP stores alpha losslessly, so quality has little
// effect here — kept high for free colour fidelity.)
// The data is only a few hundred pixels across (one pixel ~17 km), so on screen it reads as
// blocks. A light blur at native resolution softens the cell edges; no upsampling needed.
// `ctx.filter` is ignored where unsupported (older Safari), which just leaves it unblurred.
const SAT_BLUR_PX = 1;

function drawBlurred(dst: HTMLCanvasElement, src: CanvasImageSource, w: number, h: number): void {
  // Assigning width/height reallocates the backing store, so only touch them when they change.
  if (dst.width !== w) dst.width = w;
  if (dst.height !== h) dst.height = h;
  const ctx = dst.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.filter = `blur(${SAT_BLUR_PX}px)`;
  ctx.drawImage(src, 0, 0);
  ctx.filter = "none";
}

const SAT_IMAGE_TYPE = "image/webp";
const SAT_IMAGE_QUALITY = 0.9;

// Per-map, per-layer counter, so a slow texture swap can't clobber a newer one on
// the same layer. Per-layer rather than global: each channel has its own layer, and
// a stale swap on one must not be invalidated by a fresh swap on another.
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

// /api/get_token is an Auth0 session round-trip on the Next server, not a cheap read,
// and every channel fetch used to pay for its own. Share the app-wide cached token
// (lib/api/auth/token.ts) instead of keeping a private cache here — same TTL/dedup
// reasoning, now shared with axiosFetcherAuth and the v1 client.

// Cap concurrent satellite requests. With the +/-1 prefetch a single step can put a
// few requests in flight at once; capping them keeps a burst from tripping the API's
// rate limit and dropping the whole batch into the 429 backoff path below, which is
// slower than simply queuing in the first place. The visible frame is always
// requested before the prefetches (see map.tsx), so it takes the slots first and
// can't be starved by speculative work.
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
  latest = false,
  scope: Scope = DEFAULT_SATELLITE_SCOPE
): Promise<ArrayBuffer | null> {
  // The slot is held across the 429 retries too: a rate limit means the API is
  // already saturated, so keeping the queue closed is the useful backpressure.
  await acquireRequestSlot();
  try {
    return await requestSatelliteTif(channel, timestamp, latest, scope);
  } finally {
    releaseRequestSlot();
  }
}

async function requestTifFromRoute(routeUrl: string): Promise<ArrayBuffer | null> {
  const token = await getAccessToken();
  const maxRetries = 5;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiRes = await fetch(routeUrl, {
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

async function requestSatelliteTif(
  channel: SatelliteChannel,
  timestamp: string,
  latest: boolean,
  // Accepted, not yet consumed — see DEFAULT_SATELLITE_SCOPE's doc comment above.
  scope: Scope = DEFAULT_SATELLITE_SCOPE
): Promise<ArrayBuffer | null> {
  void scope;
  const apiUrl = `${API_PREFIX}/satellite/?channel=${encodeURIComponent(
    channel
  )}&timestamp=${encodeURIComponent(timestamp)}${latest ? "&latest=true" : ""}`;
  return requestTifFromRoute(apiUrl);
}

// The extent a tif draws over: its `bounds_wgs84` tag if present, else its projected bbox.
async function readBounds(image: GeoTIFFImage): Promise<TifLayerData["bounds"]> {
  const meta = (await image.getGDALMetadata()) as { bounds_wgs84?: string } | null;
  const tag = meta?.bounds_wgs84?.split(",").map(Number);
  if (tag && tag.length === 4 && tag.every((n) => isFinite(n))) {
    return tag as TifLayerData["bounds"];
  }
  const [minX, minY, maxX, maxY] = image.getBoundingBox();
  return [...mercToWgs84(minX, minY), ...mercToWgs84(maxX, maxY)];
}

function bandToImage(
  band: ArrayLike<number>,
  width: number,
  height: number,
  invert: boolean,
  maxAlpha: number = SAT_MAX_ALPHA,
  tone: ToneCurve = LINEAR_TONE
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(width, height);
  const px = imageData.data;

  for (let i = 0; i < band.length; i++) {
    const pi = i * 4;
    const v = band[i];
    if (!isFinite(v) || v === 0) {
      px[pi] = px[pi + 1] = px[pi + 2] = px[pi + 3] = 0;
      continue;
    }
    const grey = Math.pow(Math.min(1, ((v - 1) / 254) * tone.gain), tone.gamma) * 255;
    const g = invert ? 255 - grey : grey;
    px[pi] = g;
    px[pi + 1] = g;
    px[pi + 2] = g;
    px[pi + 3] = (g * maxAlpha) / 255;
  }

  ctx.putImageData(imageData, 0, 0);
  // WebP keeps the alpha channel (unlike JPEG) but compresses far better than the
  // default PNG (~4x smaller here). Falls back to the browser default if WebP isn't
  // supported (a PNG data URL).
  const out = document.createElement("canvas");
  drawBlurred(out, canvas, width, height);
  return out.toDataURL(SAT_IMAGE_TYPE, SAT_IMAGE_QUALITY);
}

export async function decodeTif(
  buf: ArrayBuffer,
  invert = false,
  maxAlpha: number = SAT_MAX_ALPHA,
  tone: ToneCurve = LINEAR_TONE
): Promise<TifLayerData> {
  const image = await (await fromArrayBuffer(buf)).getImage();
  const data = await image.readRasters();
  const band = (Array.isArray(data) ? data[0] : data) as ArrayLike<number>;
  // `missing_channels` is set by the API only on partial composite frames; empty/absent
  // otherwise. Surfaced so the UI can flag a composite built from fewer than its members.
  const meta = (await image.getGDALMetadata()) as { missing_channels?: string } | null;
  const missingChannels = meta?.missing_channels
    ? meta.missing_channels.split(",").filter(Boolean)
    : undefined;
  return {
    imageDataUrl: bandToImage(band, image.getWidth(), image.getHeight(), invert, maxAlpha, tone),
    bounds: await readBounds(image),
    missingChannels: missingChannels && missingChannels.length ? missingChannels : undefined
  };
}

export async function fetchAndDecodeSatelliteTif(
  channel: SatelliteChannel,
  timestamp: string,
  latest = false,
  scope: Scope = DEFAULT_SATELLITE_SCOPE
): Promise<TifLayerData | null> {
  const buf = await fetchSatelliteTif(channel, timestamp, latest, scope);
  if (!buf) return null;
  return decodeTif(buf, shouldInvertChannel(channel), SAT_RENDER_MAX_ALPHA, toneFor(channel));
}

export const stackKey = (iso: string): string =>
  new Date(iso).toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "_");

export type SatelliteStack = {
  channel: SatelliteChannel;
  bands: Record<string, ArrayLike<number>>;
  // Per-slot composite degradation (the band-level `missing_channels` tag the API writes on the
  // stack). Only slots that were partial appear here; absent keys mean a complete frame.
  missing: Record<string, string[]>;
  width: number;
  height: number;
  bounds: TifLayerData["bounds"];
};

export async function fetchSatelliteStack(
  channel: SatelliteChannel
): Promise<SatelliteStack | null> {
  await acquireRequestSlot();
  let buf: ArrayBuffer | null;
  try {
    buf = await requestTifFromRoute(
      `${API_PREFIX}/satellite/stack?channel=${encodeURIComponent(channel)}`
    );
  } finally {
    releaseRequestSlot();
  }
  if (!buf) return null;

  const image = await (await fromArrayBuffer(buf)).getImage();
  const data = await image.readRasters();
  const bands = (Array.isArray(data) ? data : [data]) as ArrayLike<number>[];
  const meta = (await image.getGDALMetadata()) as { timestamps?: string } | null;
  const slots = meta?.timestamps ? meta.timestamps.split(",") : [];
  const frames: Record<string, ArrayLike<number>> = {};
  const missing: Record<string, string[]> = {};
  for (let i = 0; i < slots.length; i++) {
    const ts = slots[i];
    if (!bands[i]) continue;
    frames[ts] = bands[i];
    // Per-band tag (sample index i): the composite members this slot was blended without.
    // Only present on partial slots, so most reads here come back empty.
    const bandMeta = (await image.getGDALMetadata(i)) as { missing_channels?: string } | null;
    const miss = bandMeta?.missing_channels
      ? bandMeta.missing_channels.split(",").filter(Boolean)
      : [];
    if (miss.length) missing[ts] = miss;
  }
  return {
    channel,
    bands: frames,
    missing,
    width: image.getWidth(),
    height: image.getHeight(),
    bounds: await readBounds(image)
  };
}

const stackLayerId = (ch: SatelliteChannel) => `satellite-stack-layer-${ch}`;
const stackSourceId = (ch: SatelliteChannel) => `satellite-stack-source-${ch}`;

type StackCanvas = {
  canvas: HTMLCanvasElement; // what Mapbox samples: the blurred frame
  scratch: HTMLCanvasElement; // native-resolution pixels, refilled per slot
  ctx: CanvasRenderingContext2D; // of `scratch`
  image: ImageData;
  pixels: Uint32Array;
  lut: Uint32Array;
};
const stackCanvases = new WeakMap<mapboxgl.Map, Map<string, StackCanvas>>();

function stackLut(channel: SatelliteChannel): Uint32Array {
  const tone = toneFor(channel);
  const invert = shouldInvertChannel(channel);
  const lut = new Uint32Array(256); // index 0 = nodata -> fully transparent (0)
  for (let v = 1; v < 256; v++) {
    const grey = Math.pow(Math.min(1, ((v - 1) / 254) * tone.gain), tone.gamma) * 255;
    const g = Math.round(invert ? 255 - grey : grey);
    const a = Math.round((g * SAT_RENDER_MAX_ALPHA) / 255);
    lut[v] = ((a << 24) | (g << 16) | (g << 8) | g) >>> 0; // little-endian RGBA
  }
  return lut;
}

export function removeStackLayer(map: mapboxgl.Map, channel: SatelliteChannel): void {
  if (map.getLayer(stackLayerId(channel))) map.removeLayer(stackLayerId(channel));
  if (map.getSource(stackSourceId(channel))) map.removeSource(stackSourceId(channel));
  stackCanvases.get(map)?.delete(channel);
}

export function hideStackLayer(map: mapboxgl.Map, channel: SatelliteChannel): void {
  if (map.getLayer(stackLayerId(channel))) {
    map.setLayoutProperty(stackLayerId(channel), "visibility", "none");
  }
}

// Draw one slot of the stack onto the channel's single stack layer (creating it on first use)
// and show it. Returns false if the stack has no such slot.
export function showStackFrame(
  map: mapboxgl.Map,
  stack: SatelliteStack,
  key: string,
  beforeId?: string
): boolean {
  const band = stack.bands[key];
  if (!band) return false;
  const channel = stack.channel;
  const sourceId = stackSourceId(channel);
  const layerId = stackLayerId(channel);

  let perMap = stackCanvases.get(map);
  if (!perMap) {
    perMap = new Map();
    stackCanvases.set(map, perMap);
  }
  let sc = perMap.get(channel);
  if (sc && (sc.scratch.width !== stack.width || sc.scratch.height !== stack.height)) {
    removeStackLayer(map, channel);
    sc = undefined;
  }
  if (!sc || !map.getSource(sourceId)) {
    const canvas = document.createElement("canvas");
    canvas.width = stack.width;
    canvas.height = stack.height;
    const scratch = document.createElement("canvas");
    scratch.width = stack.width;
    scratch.height = stack.height;
    const ctx = scratch.getContext("2d")!;
    const image = ctx.createImageData(stack.width, stack.height);
    sc = {
      canvas,
      scratch,
      ctx,
      image,
      pixels: new Uint32Array(image.data.buffer),
      lut: stackLut(channel)
    };
    perMap.set(channel, sc);
    const [minLon, minLat, maxLon, maxLat] = stack.bounds;
    // `canvas` is a valid Mapbox source type that the bundled typings omit.
    map.addSource(sourceId, {
      type: "canvas",
      canvas,
      animate: false,
      coordinates: [
        [minLon, maxLat],
        [maxLon, maxLat],
        [maxLon, minLat],
        [minLon, minLat]
      ]
    } as unknown as mapboxgl.AnySourceData);
    map.addLayer(
      {
        id: layerId,
        type: "raster",
        source: sourceId,
        maxzoom: CLOUD_FADE_END_ZOOM,
        layout: { visibility: "none" },
        paint: {
          "raster-opacity": satOpacityExpression(channel),
          "raster-contrast": 0.3,
          "raster-opacity-transition": { duration: 0 },
          "raster-fade-duration": 1
        }
      },
      beforeId && map.getLayer(beforeId) ? beforeId : undefined
    );
  }

  const { lut, pixels } = sc;
  for (let i = 0; i < band.length; i++) pixels[i] = lut[band[i]];
  sc.ctx.putImageData(sc.image, 0, 0);
  drawBlurred(sc.canvas, sc.scratch, stack.width, stack.height);
  // A static (animate: false) canvas source only re-uploads its texture while "playing";
  // play() then pause() uploads the current canvas exactly once.
  const src = map.getSource(sourceId) as mapboxgl.CanvasSource;
  src.play();
  src.pause();
  map.setLayoutProperty(layerId, "visibility", "visible");
  return true;
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
    existingSource.updateImage({
      url: imageDataUrl,
      coordinates: coords
    });
  } else {
    map.addSource(sourceId, {
      type: "image",
      url: imageDataUrl,
      coordinates: coords
    });
  }

  if (!map.getLayer(layerId)) {
    map.addLayer(
      {
        id: layerId,
        type: "raster",
        source: sourceId,
        // Zoomed in past the fade band the imagery is upsampled past usefulness, so stop
        // drawing it. See `CLOUD_FADE_END_ZOOM` — the opacity ramp has already reached 0
        // here, so this cuts nothing visible, it just stops paying for it.
        maxzoom: CLOUD_FADE_END_ZOOM,
        // Hidden layers use layout visibility rather than zero opacity: Mapbox
        // skips a "none" layer entirely, whereas an opacity-0 layer is still drawn
        // every frame.
        layout: { visibility: "none" },
        paint: {
          // Fade out as the map zooms in.
          "raster-opacity": satOpacityExpression(channel),
          "raster-contrast": 0.3,
          "raster-opacity-transition": { duration: 0 },
          // Disable the cross-fade between old and new textures.
          "raster-fade-duration": 1
        }
      },
      // Insert beneath the forecast/PV layers so clouds sit under them.
      beforeId && map.getLayer(beforeId) ? beforeId : undefined
    );
  } else {
    map.setPaintProperty(layerId, "raster-contrast", 0.3);
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

// Move the satellite layer to just below the anchor. Layers are created lazily, and
// applyTifLayerToMap only sets `beforeId` at creation time, so after a style reload —
// or when the anchor layer is added after the satellite one — the layer can drift
// above the forecast/PV layers. Re-asserting its position keeps the cloud beneath
// them. A missing anchor means "move to the top of the stack". Cheap: one reorder.
export function positionSatelliteLayer(
  map: mapboxgl.Map,
  channel: SatelliteChannel,
  beforeId?: string
): void {
  const anchor = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
  const layerId = satLayerId(channel);
  if (map.getLayer(layerId)) map.moveLayer(layerId, anchor);
}
