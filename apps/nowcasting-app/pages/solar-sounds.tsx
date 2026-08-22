import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { apiV1Client } from "../lib/api/v1/client";
import { bpmFor, stepMinutesOf, toPhrase, type Phrase, type Step } from "../lib/sonify/mapping";

/**
 * Solar Sounds.
 *
 * Whenever a new forecast is published it plays it as a phrase: one note per
 * settlement period, pitch rising with output, a woodblock marking the hours and
 * a heavier one starting each day. A normal day is a clean run up the scale and a
 * clean run down, so a strange one is audible without looking at anything.
 *
 * **Driven by the run, not by the clock.** It polls `forecast/last-updated` and
 * plays when the timestamp changes, so the page sounds exactly when there is
 * something new to hear. Runs arrive roughly every half hour but not on any fixed
 * minute, so the "expected" time shown is the last run plus thirty minutes — a
 * hint, not a schedule.
 *
 * **Both countries at once, and they are not tethered.** GB and NL publish on
 * their own cadences, so two runs can arrive within seconds of each other. They
 * are queued rather than mixed: playing both together would be unintelligible,
 * and dropping one would silently lose a run. The queue holds *countries*, not
 * data — at most one entry each, and the forecast is fetched when its turn comes,
 * so a country that publishes twice while waiting plays once, with the newer
 * forecast, rather than twice with a stale one.
 *
 * A phrase opens with woodblock taps saying whose it is: one for GB, two for NL.
 *
 * Unlisted on purpose — nothing links here.
 *
 * **The window starts a day back**, not now, so measured generation overlaps most
 * of it: the marimba is the forecast and the glockenspiel a half-step behind it is
 * what actually happened. Where they answer each other in unison the forecast was
 * right; where the glockenspiel sits above it we under-forecast, below and we
 * over-forecast. By the afternoon the duet carries most of the phrase, and only
 * the tail — genuinely still ahead of us — is the marimba alone.
 *
 * **Quiet hours and mute are different things**, deliberately. Mute drops the
 * volume to nothing but everything else carries on, so the strip still shows a
 * run arriving and unmuting is instant — the point being a meeting, not a day
 * off. Outside working hours nothing is queued at all, but the run is still
 * recorded as seen, so opening the laptop at nine does not unleash a backlog of
 * every forecast published overnight.
 *
 * **It has to be started by hand once.** Browsers will not let a page make noise
 * until someone has interacted with it, so the AudioContext begins suspended and
 * the first click resumes it. After that it needs no further input, which is the
 * whole point — leave the tab open and forget about it.
 */

// HYPERBLAM's elements are plain custom elements; React passes string attributes
// through to them untouched. TypeScript needs telling they exist.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "audio-blam": any;
      "sequencer-blam": any;
      "note-blam": any;
      "track-blam": any;
      "bar-blam": any;
      "bank-blam": any;
      "sample-blam": any;
      "chain-blam": any;
      "pan-blam": any;
      "limiter-blam": any;
      "reverb-blam": any;
    }
  }
}

type Country = "GB" | "NL";
const COUNTRIES: Country[] = ["GB", "NL"];

/** The generation endpoint defaults to a GB observer, which returns NL an empty series. */
const OBSERVERS: Record<Country, string> = { GB: "pvlive_in_day", NL: "ned_nl" };

/** Taps before the phrase, saying whose run this is. Equal length, so equal timing. */
const SIGNATURE: Record<Country, string[]> = {
  GB: ["C3", "0", "0", "0"],
  NL: ["C3", "0", "C3", "0"]
};

/** How far back the window reaches, so there is something to duet against. */
const HOURS_BACK = 24;

/**
 * How often to ask whether a new forecast has been published. The response is a
 * single timestamp, so 15 seconds is cheap and keeps a new run from waiting
 * around unnoticed.
 */
const POLL_SECONDS = 15;

/** Runs are roughly half-hourly, so this is what "expected" means. Only a hint. */
const RUN_MINUTES = 30;

/** Controls survive a reload: this is meant to be left open and forgotten about. */
const STORE = "solar-sounds:controls";

/**
 * Local hours, and a wrapped range works — 22 to 6 means overnight. Weekends are
 * excluded separately, since "working hours" usually means working days too.
 */
function insideHours(now: Date, from: number, to: number, weekdaysOnly: boolean): boolean {
  if (weekdaysOnly && (now.getDay() === 0 || now.getDay() === 6)) return false;
  const hour = now.getHours() + now.getMinutes() / 60;
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

// Speed is exponential in the slider position: every notch is the same ratio, so
// the slow end — where this is pleasant to leave running — gets most of the travel.
const SLOWEST = 0.4;
const FASTEST = 6;
const hoursPerSecondAt = (position: number) =>
  SLOWEST * Math.pow(FASTEST / SLOWEST, position / 100);

/** Levels settled in the testbed: the glockenspiel sits well under the marimba. */
const FORECAST_GAIN = 0.9;
const ACTUAL_GAIN = 0.084;
const PULSE_GAIN = 0.8;
const STEREO_WIDTH = 0.75;

const fmtGw = (kw: number | null) => (kw == null ? "—" : `${(kw / 1e6).toFixed(2)} GW`);

const clock = (at: string | Date | null) =>
  at == null ? "—" : new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function windowStart(): string {
  const at = new Date(Date.now() - HOURS_BACK * 3600_000);
  at.setUTCMinutes(at.getUTCMinutes() < 30 ? 0 : 30, 0, 0);
  return at.toISOString().replace(".000Z", "Z");
}

export default function SolarSounds() {
  const [follow, setFollow] = useState<Record<Country, boolean>>({ GB: true, NL: true });
  const [speed, setSpeed] = useState(34); // slider position; ≈1.2 h/sec
  const [level, setLevel] = useState(70);
  const [muted, setMuted] = useState(false);
  const [hours, setHours] = useState({ from: 9, to: 17, weekdaysOnly: true });
  const [armed, setArmed] = useState(false);
  const [runs, setRuns] = useState<Partial<Record<Country, string>>>({});
  const [showing, setShowing] = useState<{ country: Country; phrase: Phrase } | null>(null);
  const [nowPlaying, setNowPlaying] = useState<Country | null>(null);
  const [waiting, setWaiting] = useState<Country[]>([]);
  const [at, setAt] = useState<number | null>(null);
  const [detail, setDetail] = useState("Nothing fetched yet.");

  const rig = useRef<any>(null);
  const seq = useRef<any>(null);
  const seen = useRef<Partial<Record<Country, string>>>({});
  const queue = useRef<Country[]>([]);
  const busy = useRef(false);
  // The step handler runs on every scheduled step and must not be rebuilt as
  // state changes, so it reads the moving parts through refs.
  const live = useRef({
    phrase: null as Phrase | null,
    lead: 0,
    stepMinutes: 30,
    hoursPerSecond: 1.2
  });

  live.current.hoursPerSecond = hoursPerSecondAt(speed);

  // Read after mount, never during render: localStorage does not exist on the
  // server and reading it inline would make the markup disagree with the client.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? "{}");
      if (saved.follow) setFollow(saved.follow);
      if (typeof saved.speed === "number") setSpeed(saved.speed);
      if (typeof saved.level === "number") setLevel(saved.level);
      if (typeof saved.muted === "boolean") setMuted(saved.muted);
      if (saved.hours) setHours(saved.hours);
    } catch {
      // Corrupt or unavailable: the defaults are fine.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ follow, speed, level, muted, hours }));
    } catch {
      // Private browsing or a full quota; not worth interrupting anything over.
    }
  }, [follow, speed, level, muted, hours]);

  // Mute has to be instant, so it is the master gain rather than a skipped phrase.
  useEffect(() => {
    rig.current?.setAttribute("gain", muted ? "0" : (level / 100).toFixed(2));
  }, [muted, level]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const onControl = event.target instanceof Element && event.target.matches("input, button");
      if (onControl || event.metaKey || event.ctrlKey) return;
      if (event.key === "m") setMuted((previous) => !previous);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    // Captured here rather than read in the cleanup, where the ref may since have
    // moved on.
    const sequencer = seq.current;
    let cancelled = false;

    const onReady = () => {
      sequencer?.addEventListener("blam", onStep);
    };

    const onStep = (event: any) => {
      const forecastTrack = document.getElementById("ssForecastTrack") as any;
      const actualTrack = document.getElementById("ssActualTrack") as any;
      const { phrase: current, lead, stepMinutes, hoursPerSecond } = live.current;
      if (!current) return;

      // Half a step later than the marimba, so the two voices interleave rather
      // than sit on top of each other and blur into one.
      const stepsPerSecond = (hoursPerSecond * 60) / stepMinutes;
      if (typeof actualTrack?.time === "number") actualTrack.time += 0.5 / stepsPerSecond;

      // The signature taps occupy the first few steps and have no data behind them.
      const position = (forecastTrack?.step ?? 0) - lead;
      const context = rig.current?.audioContext;
      const delay = context ? Math.max(0, (event.detail.time - context.currentTime) * 1000) : 0;
      window.setTimeout(
        () => setAt(position >= 0 && position < current.kept.length ? position : null),
        delay
      );
    };

    // Imported here rather than at the top of the file: the element classes
    // extend HTMLElement at module scope, so importing them on the server throws.
    void import("../lib/vendor/hyperblam/define").then(({ defineBlamElements }) => {
      if (cancelled) return;
      // Before defining, not after: defining upgrades the elements already in the
      // page and each registers its own blamready listener as it goes. Listeners
      // run in the order they were added, and this one has to run before the
      // tracks do — that is what lets the handler above retime a track for the
      // step it is about to play.
      window.addEventListener("blamready", onReady);
      defineBlamElements();
    });

    return () => {
      cancelled = true;
      window.removeEventListener("blamready", onReady);
      sequencer?.removeEventListener("blam", onStep);
    };
  }, []);

  const load = useCallback(async (country: Country): Promise<Step[] | null> => {
    const path = { country, source: "solar" as const, region: "national" };
    const start_utc = windowStart();

    const [forecast, generation] = await Promise.all([
      apiV1Client.GET("/{country}/{source}/regions/{region}/forecast", {
        params: { path, query: { start_utc } } as any
      }),
      apiV1Client.GET("/{country}/{source}/regions/{region}/generation", {
        params: { path, query: { start_utc, observer: OBSERVERS[country] } } as any
      })
    ]);

    const values = (forecast.data as any)?.values;
    if (forecast.error || !values?.length) {
      setDetail(`Could not reach the ${country} forecast.`);
      return null;
    }

    const capacityKw = (forecast.data as any).capacity_kW ?? 0;
    const measured = new Map<string, number>(
      ((generation.data as any)?.values ?? []).map((v: any) => [v.time_utc, v.power_kW])
    );

    return values.map((value: any) => ({
      time: value.time_utc,
      forecastKw: value.power_kW ?? null,
      actualKw: measured.has(value.time_utc) ? (measured.get(value.time_utc) as number) : null,
      capacityKw
    }));
  }, []);

  /** Plays one country's current forecast, start to finish. */
  const play = useCallback(
    async (country: Country) => {
      const steps = await load(country);
      if (!steps || !rig.current || !seq.current) return;

      const phrase = toPhrase(steps);
      const stepMinutes = stepMinutesOf(steps);
      const hoursPerSecond = hoursPerSecondAt(speed);
      const signature = SIGNATURE[country];
      const lead = signature.length;
      live.current = { phrase, lead, stepMinutes, hoursPerSecond };
      setShowing({ country, phrase });

      const rests = new Array(lead).fill("0").join(" ");
      document
        .getElementById("ssForecastBar")
        ?.setAttribute("s", `${rests} ${phrase.forecast || "0"}`);
      document.getElementById("ssActualBar")?.setAttribute("s", `${rests} ${phrase.actual || "0"}`);
      document
        .getElementById("ssPulseBar")
        ?.setAttribute("s", `${signature.join(" ")} ${phrase.pulse || "0"}`);
      rig.current.setAttribute("bpm", String(bpmFor(stepMinutes, hoursPerSecond)));

      const withActuals = phrase.kept.filter((step) => step.actualKw != null).length;
      const stepsPerSecond = (hoursPerSecond * 60) / stepMinutes;
      const seconds = (phrase.kept.length + lead) / stepsPerSecond;
      setDetail(`${country} · ${phrase.kept.length} periods, ${withActuals} with actuals`);

      setNowPlaying(country);
      seq.current.stop();
      seq.current.play();

      await new Promise((done) => window.setTimeout(done, (seconds + 1) * 1000));
      seq.current?.stop();
      setNowPlaying(null);
      setAt(null);
    },
    [load, speed]
  );

  /** Drains the queue one phrase at a time; never two at once. */
  const drain = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      while (queue.current.length) {
        const country = queue.current.shift() as Country;
        setWaiting([...queue.current]);
        await play(country);
      }
    } finally {
      busy.current = false;
    }
  }, [play]);

  const enqueue = useCallback(
    (country: Country) => {
      // At most one entry per country: a second run while the first waits should
      // still play once, with whatever is current when its turn comes.
      if (!queue.current.includes(country)) queue.current.push(country);
      setWaiting([...queue.current]);
      void drain();
    },
    [drain]
  );

  const latestRun = useCallback(async (country: Country): Promise<string | null> => {
    const { data, error } = await apiV1Client.GET(
      "/{country}/{source}/regions/{region}/forecast/last-updated",
      { params: { path: { country, source: "solar", region: "national" } } as any }
    );
    return error || typeof data !== "string" ? null : data;
  }, []);

  // Polls every followed country independently, because they are independent.
  useEffect(() => {
    if (!armed) return;
    let cancelled = false;
    let first = true;

    const poll = async () => {
      const following = COUNTRIES.filter((country) => follow[country]);
      const stamps = await Promise.all(following.map((country) => latestRun(country)));
      if (cancelled) return;

      // Outside working hours a run is still recorded as seen but never queued,
      // so nine o'clock brings the current forecast rather than every run since
      // last night.
      const audible = insideHours(new Date(), hours.from, hours.to, hours.weekdaysOnly);

      following.forEach((country, index) => {
        const stamp = stamps[index];
        if (!stamp) return;
        const isNew = stamp !== seen.current[country];
        seen.current[country] = stamp;
        setRuns((previous) => ({ ...previous, [country]: stamp }));
        if ((isNew || first) && audible) enqueue(country);
      });
      first = false;
    };

    void poll();
    const id = setInterval(poll, POLL_SECONDS * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [armed, follow, hours, enqueue, latestRun]);

  const start = async () => {
    // This click is the user gesture the AudioContext needs; without it the
    // scheduler runs but the context never leaves "suspended" and nothing sounds.
    await rig.current?.audioContext?.resume();
    setArmed(true); // the poll plays whatever is current straight away
  };

  const stop = () => {
    setArmed(false);
    queue.current = [];
    setWaiting([]);
    seq.current?.stop();
    setNowPlaying(null);
    setAt(null);
  };

  const kept = showing?.phrase.kept ?? [];
  const peak = Math.max(...kept.map((s) => Math.max(s.forecastKw ?? 0, s.actualKw ?? 0)), 1);
  const here = at == null ? null : kept[at];
  const hoursPerSecond = hoursPerSecondAt(speed);
  const audible = insideHours(new Date(), hours.from, hours.to, hours.weekdaysOnly);

  const nextExpected = COUNTRIES.filter((country) => follow[country] && runs[country])
    .map(
      (country) =>
        `${country} ${clock(
          new Date(new Date(runs[country] as string).getTime() + RUN_MINUTES * 60_000)
        )}`
    )
    .join(" · ");

  const control = "rounded-md border border-mapbox-black-700 bg-mapbox-black-700 px-3 py-2 text-sm";

  return (
    <div className="min-h-screen bg-mapbox-black text-white flex items-center justify-center p-8">
      <main className="w-full max-w-2xl">
        <h1 className="text-lg font-semibold tracking-tight">Solar Sounds</h1>
        <p className="mt-1 text-sm text-ocf-gray-300">
          Plays the national solar forecast whenever a new one is published — roughly every half
          hour per country, though each run arrives when it arrives. One woodblock tap before a
          phrase means GB, two means NL.
        </p>
        <p className="mt-1 text-sm text-ocf-gray-300">
          The forecast notes are on the beat, the actuals (if available) are half a beat behind, and
          slightly softer.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={armed ? stop : start}
            className={`${control} hover:bg-mapbox-black-600`}
          >
            {armed ? "Stop" : "Start listening"}
          </button>

          {COUNTRIES.map((country) => (
            <label key={country} className="flex items-center gap-2 text-xs text-ocf-gray-300">
              <input
                type="checkbox"
                checked={follow[country]}
                onChange={(event) =>
                  setFollow((previous) => ({ ...previous, [country]: event.target.checked }))
                }
              />
              {country}
            </label>
          ))}

          <button
            type="button"
            onClick={() => COUNTRIES.filter((country) => follow[country]).forEach(enqueue)}
            disabled={!armed}
            className="rounded-md border border-mapbox-black-700 px-3 py-2 text-sm disabled:opacity-40 hover:bg-mapbox-black-700"
          >
            Play again
          </button>

          <label className="flex items-center gap-2 text-xs text-ocf-gray-300">
            Speed
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
            <span className="tabular-nums">{hoursPerSecond.toFixed(1)} h/s</span>
          </label>

          <button
            type="button"
            onClick={() => setMuted((previous) => !previous)}
            title="m"
            className={`rounded-md border px-3 py-2 text-sm ${
              muted
                ? "border-ocf-yellow text-ocf-yellow"
                : "border-mapbox-black-700 hover:bg-mapbox-black-700"
            }`}
          >
            {muted ? "Muted" : "Mute"}
          </button>

          <label className="flex items-center gap-2 text-xs text-ocf-gray-300">
            Volume
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={level}
              onChange={(event) => setLevel(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ocf-gray-300">
          <label className="flex items-center gap-2">
            Quiet outside
            <input
              type="number"
              min={0}
              max={23}
              value={hours.from}
              onChange={(event) =>
                setHours((previous) => ({ ...previous, from: Number(event.target.value) }))
              }
              className="w-14 rounded-md border border-mapbox-black-700 bg-mapbox-black-700 px-2 py-1 text-white"
            />
            to
            <input
              type="number"
              min={0}
              max={23}
              value={hours.to}
              onChange={(event) =>
                setHours((previous) => ({ ...previous, to: Number(event.target.value) }))
              }
              className="w-14 rounded-md border border-mapbox-black-700 bg-mapbox-black-700 px-2 py-1 text-white"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hours.weekdaysOnly}
              onChange={(event) =>
                setHours((previous) => ({ ...previous, weekdaysOnly: event.target.checked }))
              }
            />
            Weekdays only
          </label>
        </div>

        <p className="mt-5 text-sm tabular-nums text-ocf-yellow">
          {!armed
            ? "Silent — press start"
            : !audible
            ? `Quiet until ${String(hours.from).padStart(2, "0")}:00${
                hours.weekdaysOnly ? " on a weekday" : ""
              } — still watching`
            : muted
            ? "Muted"
            : nowPlaying
            ? `Playing ${nowPlaying}${waiting.length ? ` · ${waiting.join(", ")} queued` : ""}`
            : nextExpected
            ? `Next expected around ${nextExpected}`
            : "Waiting for the first run"}
        </p>

        {/* Forecast in amber, measured generation overlaid in blue, the step
            being played picked out as it goes. */}
        <div className="mt-4 flex h-28 items-end gap-px" aria-hidden="true">
          {kept.map((step, index) => (
            <div key={step.time} className="relative h-full flex-1">
              <div
                className="absolute inset-x-0 bottom-0 rounded-sm"
                style={{
                  height: `${((step.forecastKw ?? 0) / peak) * 100}%`,
                  background: "#FFD053",
                  opacity: index === at ? 1 : 0.5
                }}
              />
              <div
                className="absolute bottom-0 inset-x-1/4"
                style={{
                  height: `${((step.actualKw ?? 0) / peak) * 100}%`,
                  background: "#4cc9f0",
                  opacity: index === at ? 1 : 0.85
                }}
              />
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs tabular-nums text-ocf-gray-300">
          {here
            ? `${showing?.country} · ${new Date(here.time).toLocaleString([], {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit"
              })} · forecast ${fmtGw(here.forecastKw)}${
                here.actualKw == null ? "" : ` · actual ${fmtGw(here.actualKw)}`
              }`
            : detail}
        </p>

        <audio-blam
          ref={rig}
          id="ssRig"
          bpm="120"
          gain={muted ? "0" : (level / 100).toFixed(2)}
          hidden
        >
          <sequencer-blam ref={seq} id="ssSeq">
            <note-blam id="ssForecastVoice" root="C4" gain={String(FORECAST_GAIN)} length="4">
              <track-blam id="ssForecastTrack">
                <bar-blam id="ssForecastBar" s="0"></bar-blam>
              </track-blam>
              <bank-blam>
                <sample-blam src="/sounds/tone.wav" root="C4"></sample-blam>
              </bank-blam>
              <chain-blam>
                <pan-blam pan={String(-STEREO_WIDTH)}></pan-blam>
                <reverb-blam mix="0.22" cutoff="6000">
                  <sample-blam src="/sounds/ir.wav"></sample-blam>
                </reverb-blam>
                <limiter-blam></limiter-blam>
              </chain-blam>
            </note-blam>

            <note-blam id="ssActualVoice" root="C4" gain={String(ACTUAL_GAIN)} length="4">
              <track-blam id="ssActualTrack">
                <bar-blam id="ssActualBar" s="0"></bar-blam>
              </track-blam>
              <bank-blam>
                <sample-blam src="/sounds/tone-glock.wav" root="C4"></sample-blam>
              </bank-blam>
              <chain-blam>
                <pan-blam pan={String(STEREO_WIDTH)}></pan-blam>
                <limiter-blam></limiter-blam>
              </chain-blam>
            </note-blam>

            <note-blam
              id="ssPulseVoice"
              root="C4"
              gain={String(PULSE_GAIN)}
              length="0.5"
              choke="0.05"
            >
              <track-blam id="ssPulseTrack">
                <bar-blam id="ssPulseBar" s="0"></bar-blam>
              </track-blam>
              <bank-blam>
                <sample-blam src="/sounds/tone-pulse.wav" root="C4"></sample-blam>
              </bank-blam>
              <chain-blam>
                <limiter-blam></limiter-blam>
              </chain-blam>
            </note-blam>
          </sequencer-blam>
        </audio-blam>
      </main>
    </div>
  );
}

export const getServerSideProps = withPageAuthRequired();
