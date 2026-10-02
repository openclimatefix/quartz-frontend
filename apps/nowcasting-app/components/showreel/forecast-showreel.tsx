import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { FeatureCollection } from "geojson";

import { getCountryConfig } from "../../config/countries";
import { buildMapGeometry } from "../helpers/data";
import { loadGeoAsset } from "../../lib/geo/assets";
import { normaliseRegions } from "../../lib/domain/normalise";
import { fetchDescriptor } from "../../hooks/data/query";
import * as queries from "../../lib/api/v1/queries";
import type { Scope } from "../../lib/domain/types";
import { theme } from "../../tailwind.config";

/**
 * TEMP: the regional forecast map on its own, out of black, as a looping animation.
 *
 * Deliberately *not* `PvLatestMap`: no cursor, no delta, no popups, no satellite. One Mapbox
 * instance with an empty style (no basemap at all), each country's finest polygons, and one
 * fill per country whose opacity is the forecast as a fraction of capacity. Values are lerped
 * between slots on every frame so the shape breathes rather than steps.
 *
 * Data per country: one `forecasts/period` call (the API's own ±2-day cache, the request the
 * dashboard makes) plus a gentle fan-out of `forecasts/snapshot` calls for the older slots,
 * which are cached in localStorage because a historic forecast never changes.
 */

type CountrySpec = { code: string; regionType: string; key: string };
/** Countries drawn, with the HUD/keyboard key that toggles each. */
const COUNTRIES: CountrySpec[] = [
  { code: "gb", regionType: "gsp", key: "1" },
  { code: "nl", regionType: "province", key: "2" }
];
const SOURCE = "solar";

/** How far back the loop starts. Forward it reaches as far as the API has (GB ~36 h, NL 48). */
const DAYS_BACK = 7;
/** Snapshot sampling cadence, also the ←/→ step. NL publishes 15-minutely; 30 is enough here. */
const SLOT_MS = 1_800_000;
const DAY_MS = 86_400_000;

/** Playback: one real day per this many seconds. */
const SECONDS_PER_DAY = 6;
/** First frame fades up from black over this long. */
const FADE_IN_MS = 2500;
/** A toggled country fades in or out over this long. */
const TOGGLE_FADE_MS = 700;

/** Opacity at zero output — a whisper of the country's shape in the dark, or 0 for true black. */
const NIGHT_OPACITY = 0.02;
/** Fraction of capacity that draws at full. Matches the dashboard's percentage ramp top. */
const RAMP_TOP = 0.8;

const yellow = theme.extend.colors.solar.DEFAULT;
/**
 * Optional land underlay: the same polygons in a flat dark grey beneath the yellow, which is
 * what the dashboard's basemap gives it — a 40 % yellow over grey reads lighter than over
 * black. `null` for the fill straight onto black.
 */
const LAND_UNDERLAY: string | null = "#2a2a2a"; // null for the fill straight onto black
/**
 * The underlay fades with daylight so the night is still black: fully up between the two
 * `noon`-curve values below (see `daylightFor`), gone outside them. 0.3 → 0.7 is roughly
 * 04:40–08:30 UTC rising and the mirror in the evening.
 */
const UNDERLAY_DAWN = 0.3;
const UNDERLAY_DAY = 0.7;
/** Region borders, as the dashboard draws them (`pvLatestMap.tsx`). */
const BORDER_COLOR = "#ffffff";
const BORDER_WIDTH = 0.6;
const BORDER_OPACITY = 0.2;

/**
 * Variable playback, by time of day. The multiplier on `secondsPerDay` is a raised cosine
 * over the UTC day centred on `NOON_UTC_HOURS`, raised to `DAY_SHAPE`, so it runs at
 * `SPEED_AT_NIGHT` through the night and eases down to `SPEED_AT_NOON` in the middle of the
 * day; a higher `DAY_SHAPE` narrows the slow zone around noon. Time-driven rather than
 * output-driven so a dull day plays at the same pace as a bright one. Both speeds 1 for a
 * constant rate.
 */
const SPEED_AT_NIGHT = 2.5;
const SPEED_AT_NOON = 0.5;
const NOON_UTC_HOURS = 12;
const DAY_SHAPE = 2;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** 1 at `NOON_UTC_HOURS`, 0 twelve hours from it, a cosine between. */
const noonFor = (t: number) => {
  const hours = (t % DAY_MS) / 3_600_000;
  return (Math.cos(((hours - NOON_UTC_HOURS) / 24) * 2 * Math.PI) + 1) / 2;
};
const speedFor = (t: number) =>
  SPEED_AT_NIGHT + (SPEED_AT_NOON - SPEED_AT_NIGHT) * Math.pow(noonFor(t), DAY_SHAPE);
const daylightFor = (t: number) =>
  smoothstep((noonFor(t) - UNDERLAY_DAWN) / (UNDERLAY_DAY - UNDERLAY_DAWN));

type Series = {
  /** Slot instants, ms since epoch, ascending. */
  times: number[];
  /** Per feature id, normalized output per slot (0..1), aligned to `times`. */
  byId: Map<string | number, Float32Array>;
};

/** One slot's values, as [region name, normalized output]. What the snapshot cache stores. */
type SlotValues = Array<[string, number]>;

// --- snapshot cache ----------------------------------------------------------------------

const cachePrefix = (spec: CountrySpec) => `showreel:${spec.code}:${spec.regionType}:`;
const readCached = (spec: CountrySpec, t: number): SlotValues | undefined => {
  try {
    const raw = localStorage.getItem(`${cachePrefix(spec)}${t}`);
    return raw ? (JSON.parse(raw) as SlotValues) : undefined;
  } catch {
    return undefined;
  }
};
const writeCached = (spec: CountrySpec, t: number, values: SlotValues) => {
  try {
    localStorage.setItem(`${cachePrefix(spec)}${t}`, JSON.stringify(values));
  } catch {
    // Quota or private mode: live without the cache.
  }
};
const evictCachedBefore = (spec: CountrySpec, oldest: number) => {
  const prefix = cachePrefix(spec);
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix) && Number(key.slice(prefix.length)) < oldest) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
};

// --- data ----------------------------------------------------------------------------------

const loadPeriod = (scope: Scope) => fetchDescriptor(queries.forecastPeriod(scope, {}));
const loadSnapshot = (scope: Scope, time: number) =>
  fetchDescriptor(queries.forecastSnapshot(scope, { time: new Date(time) }));

/**
 * Snapshots for the slots `period` does not cover, fetched gently: a few hundred cold requests
 * against prod go out `SNAPSHOT_CONCURRENCY` at a time with a pause between. A failed slot is
 * skipped (logged) and later held over by the gap fill.
 */
const SNAPSHOT_CONCURRENCY = 2;
const SNAPSHOT_PAUSE_MS = 100;

const loadSnapshots = async (
  spec: CountrySpec,
  scope: Scope,
  slots: number[],
  onProgress: (done: number, total: number) => void
) => {
  const results = new Map<number, SlotValues>();
  const queue = slots.filter((t) => {
    const cached = readCached(spec, t);
    if (cached) results.set(t, cached);
    return !cached;
  });
  const total = queue.length;
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const t = queue.shift()!;
      try {
        const snap = await loadSnapshot(scope, t);
        const values: SlotValues = snap.values
          .filter((v) => v.capacity_kW > 0 && v.power_kW != null)
          .map((v) => [
            v.region_name,
            Math.round(clamp01(v.power_kW / v.capacity_kW) * 1000) / 1000
          ]);
        results.set(t, values);
        writeCached(spec, t, values);
      } catch (e) {
        console.warn(`[showreel ${spec.code}] snapshot ${new Date(t).toISOString()} failed`, e);
      }
      onProgress(++done, total);
      await new Promise((r) => setTimeout(r, SNAPSHOT_PAUSE_MS));
    }
  };
  await Promise.all(Array.from({ length: SNAPSHOT_CONCURRENCY }, worker));
  return results;
};

/**
 * The whole span as one aligned series. Regions are keyed the way `buildMapGeometry` keys
 * features (`metadata.gsp_id` when present, else the name), so rows go straight through
 * `setFeatureState`.
 */
const loadSeries = async (
  spec: CountrySpec,
  idByName: Map<string, string | number>,
  onProgress: (done: number, total: number) => void
): Promise<Series> => {
  const scope: Scope = { country: spec.code, source: SOURCE, regionType: spec.regionType };
  const period = await loadPeriod(scope);
  const periodTimes = period.times_utc.map((t) => Date.parse(t));
  const periodStart = Math.min(...periodTimes);

  const oldest = Math.ceil((Date.now() - DAY_MS * DAYS_BACK) / SLOT_MS) * SLOT_MS;
  const older: number[] = [];
  for (let t = periodStart - SLOT_MS; t >= oldest; t -= SLOT_MS) older.push(t);
  evictCachedBefore(spec, oldest);
  const snapshots = await loadSnapshots(spec, scope, older, onProgress);

  const times = [...snapshots.keys(), ...periodTimes].sort((a, b) => a - b);
  const slotIndex = new Map(times.map((t, i) => [t, i]));
  const byId = new Map<string | number, Float32Array>();
  const rowFor = (name: string) => {
    const id = idByName.get(name);
    if (id === undefined) return undefined;
    let row = byId.get(id);
    if (!row) {
      row = new Float32Array(times.length).fill(NaN);
      byId.set(id, row);
    }
    return row;
  };

  period.regions.forEach((region) => {
    const row = rowFor(region.region_name);
    if (!row) return;
    region.power_kW.forEach((kw, i) => {
      const slot = slotIndex.get(periodTimes[i]);
      if (slot !== undefined && region.capacity_kW && kw != null) {
        row[slot] = clamp01(kw / region.capacity_kW);
      }
    });
  });
  snapshots.forEach((values, t) => {
    const slot = slotIndex.get(t)!;
    values.forEach(([name, v]) => {
      const row = rowFor(name);
      if (row) row[slot] = v;
    });
  });

  // Hold the previous value over a gap, so a missing slot is a pause and not a flash to black.
  // A region with no value anywhere (Shetland's GSP comes back all-null) stays NaN through
  // both passes, and a NaN in feature state makes Mapbox's expression fail — which it
  // answers with the paint default, `fill-opacity: 1`. Dark is the honest reading.
  byId.forEach((row) => {
    for (let i = 1; i < row.length; i++) if (Number.isNaN(row[i])) row[i] = row[i - 1];
    for (let i = row.length - 2; i >= 0; i--) if (Number.isNaN(row[i])) row[i] = row[i + 1];
    for (let i = 0; i < row.length; i++) if (Number.isNaN(row[i])) row[i] = 0;
  });

  const iso = (t: number) => new Date(t).toISOString().slice(0, 16);
  const gaps = times.filter((t, i) => i && t - times[i - 1] !== SLOT_MS).length;
  console.log(
    `[showreel ${spec.code}] ${times.length} slots ${iso(times[0])} → ${iso(
      times[times.length - 1]
    )} (${snapshots.size} snapshot + ${
      periodTimes.length
    } period), non-30min gaps: ${gaps}, regions: ${byId.size}`
  );
  return { times, byId };
};

const loadGeometry = async (spec: CountrySpec): Promise<FeatureCollection> => {
  const geo = getCountryConfig(spec.code)?.geo[spec.regionType];
  if (!geo) throw new Error(`no ${spec.code} ${spec.regionType} geometry config`);
  const [shapes, regionsRaw] = await Promise.all([
    loadGeoAsset<FeatureCollection>(geo.url),
    fetchDescriptor(
      queries.regions({ country: spec.code, source: SOURCE }, { regionType: spec.regionType })
    )
  ]);
  return buildMapGeometry({
    level: {
      regionType: spec.regionType,
      level: 10,
      label: spec.regionType,
      minZoom: 0,
      maxZoom: 24,
      derived: false
    },
    shapes,
    regions: normaliseRegions(regionsRaw),
    joinProperty: geo.joinProperty,
    joinTransform: geo.joinTransform,
    country: spec.code
  });
};

// --- map -----------------------------------------------------------------------------------

type Layer = {
  spec: CountrySpec;
  sourceId: string;
  fillId: string;
  borderId: string;
  series: Series;
  /** Fade, 0..1, eased toward `enabled` each frame. */
  alpha: number;
};

const addLayer = (map: mapboxgl.Map, spec: CountrySpec, geometry: FeatureCollection) => {
  const sourceId = `showreel-${spec.code}`;
  const fillId = `${sourceId}-fill`;
  const borderId = `${sourceId}-border`;
  // `promoteId`: a feature's Mapbox id is its `properties.id` (what `buildMapGeometry` sets),
  // which lets a string id take feature state. GB's are numeric gsp_ids and worked without
  // it; NL's are province names and drew nothing until it was declared.
  map.addSource(sourceId, { type: "geojson", data: geometry, promoteId: "id" });
  if (LAND_UNDERLAY) {
    map.addLayer({
      id: `${sourceId}-land`,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": LAND_UNDERLAY,
        // `d` is daylight, 0..1, set alongside the value and the country fade.
        "fill-opacity": [
          "*",
          ["coalesce", ["feature-state", "a"], 1],
          ["coalesce", ["feature-state", "d"], 1]
        ]
      }
    });
  }
  map.addLayer({
    id: fillId,
    type: "fill",
    source: sourceId,
    paint: {
      "fill-color": yellow,
      // `a` is the country's fade (0..1), set per feature alongside the value: Mapbox cannot
      // transition a feature-state-driven paint property, so the fade is driven by the frame
      // loop and travels the same way the value does.
      "fill-opacity": [
        "*",
        ["coalesce", ["feature-state", "a"], 1],
        [
          "interpolate",
          ["linear"],
          ["coalesce", ["feature-state", "v"], 0],
          0,
          NIGHT_OPACITY,
          RAMP_TOP,
          1
        ]
      ]
    }
  });
  map.addLayer({
    id: borderId,
    type: "line",
    source: sourceId,
    paint: {
      "line-color": BORDER_COLOR,
      "line-width": BORDER_WIDTH,
      "line-opacity": ["*", ["coalesce", ["feature-state", "a"], 1], BORDER_OPACITY]
    }
  });
  return { sourceId, fillId, borderId };
};

/** Neighbouring slots around `t` and the blend between them. */
const neighbours = (times: number[], t: number) => {
  let hi = times.findIndex((x) => x > t);
  if (hi < 0) hi = times.length - 1;
  const lo = Math.max(0, hi - 1);
  const w = hi === lo ? 0 : (t - times[lo]) / (times[hi] - times[lo]);
  return { lo, hi, w };
};

type Clock = {
  toggle: () => void;
  /** Move by slots; pauses. */
  step: (slots: number) => void;
  /** Multiply seconds-per-day; >1 is slower. */
  speed: (factor: number) => void;
  /** Start/stop recording the canvas to a downloaded .webm. Playback is left alone. */
  record: () => void;
  playing: boolean;
  recording: boolean;
  secondsPerDay: number;
};

const IDLE_CLOCK: Clock = {
  toggle: () => {},
  step: () => {},
  speed: () => {},
  record: () => {},
  playing: false,
  recording: false,
  secondsPerDay: SECONDS_PER_DAY
};

/**
 * Recording: canvas frame rate and encoder bitrate. WebM/VP9 only. Chrome's native MP4
 * muxing was tried (2026-10-02) and played back in QuickTime with wrong colours and
 * flicker, so the MP4 step stays with ffmpeg:
 *   ffmpeg -i in.webm -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart out.mp4
 */
const RECORD_FPS = 60;
const RECORD_BPS = 24_000_000;
const RECORD_MIME_TYPES: Array<[mime: string, ext: string]> = [
  ["video/webm;codecs=vp9", "webm"],
  ["video/webm;codecs=vp8", "webm"],
  ["video/webm", "webm"]
];
const recordFormat = () => RECORD_MIME_TYPES.find(([mime]) => MediaRecorder.isTypeSupported(mime));

const ForecastShowreel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [view, setView] = useState("");
  const [playback, setPlayback] = useState("");
  const [hudVisible, setHudVisible] = useState(true);
  const [enabled, setEnabled] = useState<Set<string>>(new Set(COUNTRIES.map((c) => c.code)));
  const clock = useRef<Clock>(IDLE_CLOCK);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const toggleCountry = (code: string) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  // Keyboard: space play/pause, ←/→ step a slot (shift: a day), [ ] slower/faster, h hides HUD,
  // 1/2 toggle countries.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const country = COUNTRIES.find((c) => c.key === e.key);
      if (country) return toggleCountry(country.code);
      switch (e.key) {
        case " ":
          e.preventDefault();
          clock.current.toggle();
          break;
        case "ArrowLeft":
          clock.current.step(e.shiftKey ? -DAY_MS / SLOT_MS : -1);
          break;
        case "ArrowRight":
          clock.current.step(e.shiftKey ? DAY_MS / SLOT_MS : 1);
          break;
        case "[":
          clock.current.speed(1.15);
          break;
        case "]":
          clock.current.speed(1 / 1.15);
          break;
        case "r":
          clock.current.record();
          break;
        case "h":
          setHudVisible((v) => !v);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // HUD shows while the mouse is moving and fades two seconds after it stops, so a screencap
  // taken with the hands off is clean.
  const [mouseActive, setMouseActive] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onMove = () => {
      setMouseActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setMouseActive(false), 2000);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      // No basemap: a country only exists where it generates.
      style: { version: 8, sources: {}, layers: [] },
      // Frames GB and NL together; scroll/pinch to zoom, drag to pan for a tighter shot.
      center: [1.2, 53.6],
      zoom: 5.0,
      // Rotation and pitch stay off: an accidental tilt is hard to undo without chrome.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
      fadeDuration: 0,
      // So `canvas.captureStream` sees the frame after Mapbox has drawn it.
      preserveDrawingBuffer: true
    });
    map.touchZoomRotate.disableRotation();
    map.on("moveend", () => {
      const c = map.getCenter();
      setView(`z${map.getZoom().toFixed(2)} ${c.lat.toFixed(3)},${c.lng.toFixed(3)}`);
    });

    let frame = 0;
    let cancelled = false;
    const layers: Layer[] = [];

    // The loop runs over the whole UTC days every loaded country covers, so the wrap is
    // night-to-night. Recomputed when a country joins.
    let t0 = 0;
    let t1 = 0;
    let span = 1;
    const fitLoop = () => {
      const starts = layers.map((l) => l.series.times[0]);
      const ends = layers.map((l) => l.series.times[l.series.times.length - 1]);
      const firstMidnight = Math.ceil(Math.max(...starts) / DAY_MS) * DAY_MS;
      const lastMidnight = Math.floor(Math.min(...ends) / DAY_MS) * DAY_MS;
      const wholeDays = lastMidnight - firstMidnight >= DAY_MS;
      t0 = wholeDays ? firstMidnight : Math.max(...starts);
      t1 = wholeDays ? lastMidnight : Math.min(...ends);
      span = Math.max(1, t1 - t0);
      console.log(
        `[showreel] looping ${new Date(t0).toISOString()} → ${new Date(t1).toISOString()}`
      );
    };
    const wrap = (t: number) => ((((t - t0) % span) + span) % span) + t0;

    let simulated = 0;
    const setHud = () =>
      setPlayback(
        `${clock.current.recording ? "● REC" : clock.current.playing ? "▶" : "❚❚"} ${new Date(
          simulated
        )
          .toISOString()
          .slice(0, 16)
          .replace("T", " ")}Z  ${clock.current.secondsPerDay}s/day ×${speedFor(simulated).toFixed(
          2
        )}`
      );

    const start = () => {
      simulated = t0;
      const started = performance.now();
      let lastPerf = started;
      clock.current = {
        toggle: () => {
          clock.current.playing = !clock.current.playing;
          setHud();
        },
        step: (slots) => {
          clock.current.playing = false;
          simulated = wrap(simulated + slots * SLOT_MS);
          setHud();
        },
        speed: (factor) => {
          clock.current.secondsPerDay =
            Math.round(Math.min(120, Math.max(0.5, clock.current.secondsPerDay * factor)) * 10) /
            10;
          setHud();
        },
        record: () => {
          if (clock.current.recording) return stopRecording();
          const format = recordFormat();
          if (!format) return setStatus("MediaRecorder: no video support in this browser");
          const [mimeType, ext] = format;
          const stream = map.getCanvas().captureStream(RECORD_FPS);
          const chunks: Blob[] = [];
          recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: RECORD_BPS });
          recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `showreel-${new Date()
              .toISOString()
              .slice(0, 19)
              .replace(/[T:]/g, "-")}-${Math.round(map.getCanvas().width)}w.${ext}`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
          };
          clock.current.recording = true;
          recorder.start();
          console.log(`[showreel] recording ${mimeType}`);
          setHud();
        },
        playing: true,
        recording: false,
        secondsPerDay: SECONDS_PER_DAY
      };
      let recorder: MediaRecorder | null = null;
      const stopRecording = () => {
        clock.current.recording = false;
        recorder?.stop();
        recorder = null;
        setHud();
      };

      const tick = (nowPerf: number) => {
        if (cancelled) return;
        const dt = nowPerf - lastPerf;
        lastPerf = nowPerf;
        const fade = Math.min(1, (nowPerf - started) / FADE_IN_MS);
        const d = daylightFor(simulated) * fade;

        layers.forEach((layer) => {
          const { spec, sourceId, series } = layer;
          const on = enabledRef.current.has(spec.code);
          const target = on ? 1 : 0;
          const stepAlpha = dt / TOGGLE_FADE_MS;
          layer.alpha =
            layer.alpha < target
              ? Math.min(target, layer.alpha + stepAlpha)
              : Math.max(target, layer.alpha - stepAlpha);
          const a = smoothstep(layer.alpha);
          if (a === 0) return; // fully out: leave the last state, nothing to draw

          const { lo, hi, w } = neighbours(series.times, simulated);
          series.byId.forEach((row, id) => {
            const v = (row[lo] * (1 - w) + row[hi] * w) * fade;
            map.setFeatureState({ source: sourceId, id }, { v: Number.isFinite(v) ? v : 0, a, d });
          });
        });

        if (clock.current.playing) {
          const rate = (DAY_MS / (clock.current.secondsPerDay * 1000)) * speedFor(simulated);
          simulated = wrap(simulated + dt * rate);
          if (Math.floor(nowPerf / 250) !== Math.floor((nowPerf - dt) / 250)) setHud();
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    // Countries load one after another (the snapshot fan-out is the slow part, and two at
    // once would double the load on prod). Playback starts with the first; the rest join.
    const run = async () => {
      await new Promise<void>((resolve) =>
        map.loaded() ? resolve() : map.once("load", () => resolve())
      );
      for (const spec of COUNTRIES) {
        try {
          await loadCountry(spec);
        } catch (e) {
          console.error(`[showreel ${spec.code}] failed`, e);
          setStatus(`${spec.code} failed: ${String((e as Error)?.message ?? e)}`);
        }
        if (cancelled) return;
      }
      if (!layers.length) setStatus("no forecast data in range");
    };

    const loadCountry = async (spec: CountrySpec) => {
      {
        const geometry = await loadGeometry(spec);
        if (cancelled) return;
        const idByName = new Map<string, string | number>();
        geometry.features.forEach((f) => {
          const name = f.properties?.regionName;
          if (name && f.id !== undefined) idByName.set(name, f.id);
        });
        const series = await loadSeries(spec, idByName, (done, total) =>
          setStatus(`loading ${spec.code} ${done}/${total} slots`)
        );
        if (cancelled) return;
        setStatus(null);
        if (series.times.length < 2) {
          console.warn(`[showreel ${spec.code}] no forecast data in range`);
          return;
        }
        const ids = addLayer(map, spec, geometry);
        // Starts at 0 and fades up (if enabled) on its first frames; a feature with no state
        // yet draws at `a: 1`, so give every feature a state before the layer is visible.
        series.byId.forEach((_row, id) =>
          map.setFeatureState({ source: ids.sourceId, id }, { v: 0, a: 0, d: 0 })
        );
        layers.push({ spec, ...ids, series, alpha: 0 });
        fitLoop();
        console.log(`[showreel ${spec.code}] layer added, ${series.byId.size} regions`);
        if (layers.length === 1) start();
      }
    };

    run().catch((e) => {
      console.error(e);
      setStatus(String(e?.message ?? e));
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      map.remove();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      <div ref={containerRef} className="h-full w-full" />
      <div
        className={`absolute bottom-10 left-3 select-none whitespace-pre font-mono text-xs text-white/50 transition-opacity duration-500 ${
          status || (hudVisible && mouseActive) ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="mb-1 flex gap-2">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => toggleCountry(c.code)}
              className={`rounded border px-1.5 py-0.5 uppercase ${
                enabled.has(c.code)
                  ? "border-white/50 text-white/80"
                  : "border-white/15 text-white/25"
              }`}
            >
              {c.key} {c.code}
            </button>
          ))}
        </div>
        {status ?? playback}
        {"\n"}
        {view}
        {"\n"}
        <span className="text-white/25">
          space play/pause · ←→ step (shift: day) · [ ] slower/faster · 1/2 countries · r record
          start/stop · h hide · scroll zoom
        </span>
      </div>
    </div>
  );
};

export default ForecastShowreel;
