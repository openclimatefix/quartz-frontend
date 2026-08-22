/**
 * Turning a forecast into notes.
 *
 * One settlement period becomes one step. Power as a fraction of installed
 * capacity picks a degree of a scale, and zero power is a rest — so night is
 * silence and the day boundaries are audible gaps. The output is a space
 * separated list of note names for HYPERBLAM's `<bar-blam s="...">`, where `0`
 * means "no note here".
 *
 * The constants below were settled by ear against ten days of GB and NL data in
 * a testbed (see the Solar Sounds page for what survived). They are deliberately
 * fixed here: this module exists to make one tuned sound, not to be configurable.
 */

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Major pentatonic: no interval in it can sound wrong, so anomalies read as rhythm. */
const SCALE = [0, 2, 4, 7, 9];
const ROOT = "C3";
const OCTAVES = 3;

/**
 * GB peaks near half of nameplate even on the best days, so mapping the full
 * 0–100% would leave the top of the scale permanently silent.
 */
const CAPACITY_CEILING = 0.6;

/**
 * Above 1 the top of the range gets more of the scale. The ramp up and down is
 * the least informative part of a solar day — it climbs at the rate it always
 * climbs — so resolution is better spent on the middle.
 */
const MIDDAY_GAMMA = 2;

/** Below this fraction of capacity there is nothing to hear: call it night. */
const REST_FLOOR = 0.002;

/** A summer night is hours of silence. Enough of it to mark the day, no more. */
const NIGHT_HOURS = 2;

const PULSE_BEAT = "C4";
const PULSE_ACCENT = "C3";

export type Step = {
  /** ISO timestamp, UTC. */
  time: string;
  forecastKw: number | null;
  /** Measured generation, where it exists — null for anything still in the future. */
  actualKw: number | null;
  capacityKw: number;
};

export type Phrase = {
  /** Note names for the forecast voice, one per sounded step. */
  forecast: string;
  /** The same for measured generation; rests wherever there is no measurement yet. */
  actual: string;
  /** Note names for the woodblock marking the hours. */
  pulse: string;
  /** The steps that survived the night trim, in order, for display. */
  kept: Step[];
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function nameToMidi(name: string): number {
  const accidental = name[1] === "#" ? 1 : name[1] === "b" ? -1 : 0;
  const octave = parseInt(name.match(/-?\d+$/)?.[0] ?? "4", 10);
  return SEMITONES[name[0].toUpperCase()] + accidental + 12 * (octave + 1);
}

const midiToName = (midi: number) =>
  `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

/**
 * `OCTAVES` full octaves of the scale, capped with the root on top — so the
 * highest note is always the root, three octaves above where it started.
 */
function degrees(): string[] {
  const root = nameToMidi(ROOT);
  const out: string[] = [];
  for (let octave = 0; octave < OCTAVES; octave++) {
    for (const step of SCALE) out.push(midiToName(root + octave * 12 + step));
  }
  out.push(midiToName(root + OCTAVES * 12));
  return out;
}

const isRest = (power: number | null, capacityKw: number) =>
  power == null || capacityKw <= 0 || power / capacityKw < REST_FLOOR;

/** Night is where neither voice has anything to say. */
const isSilent = (step: Step) =>
  isRest(step.forecastKw, step.capacityKw) && isRest(step.actualKw, step.capacityKw);

const dayOf = (iso: string) => iso.slice(0, 10);

/**
 * Runs of rests get truncated rather than dropped, so the gap still marks the
 * day boundary without costing tens of seconds of dead air.
 */
function shortenNight(steps: Step[], stepMinutes: number): Step[] {
  const limit = Math.max(1, Math.round((NIGHT_HOURS * 60) / stepMinutes));
  const kept: Step[] = [];
  let run = 0;
  for (const step of steps) {
    if (!isSilent(step)) {
      run = 0;
      kept.push(step);
      continue;
    }
    if (++run <= limit) kept.push(step);
  }
  return kept;
}

/** Minutes between settlement periods — GB settles every 30, NL every 15. */
export function stepMinutesOf(steps: Step[]): number {
  if (steps.length < 2) return 30;
  const gap = (new Date(steps[1].time).getTime() - new Date(steps[0].time).getTime()) / 60000;
  return Math.round(gap) || 30;
}

/**
 * The pulse is a clock, not a line: it marks real hours rather than steps, so it
 * is the same figure whether a step is half an hour or a quarter. The accent
 * falls on the first step of each day rather than on midnight, because midnight
 * usually falls inside the stretch of night that has just been trimmed away.
 */
function pulseFor(kept: Step[]): string {
  let previousDay: string | null = null;
  return kept
    .map((step) => {
      const day = dayOf(step.time);
      if (day !== previousDay) {
        previousDay = day;
        return PULSE_ACCENT;
      }
      return new Date(step.time).getUTCMinutes() === 0 ? PULSE_BEAT : "0";
    })
    .join(" ");
}

function voice(kept: Step[], notes: string[], pick: (step: Step) => number | null): string {
  return kept
    .map((step) => {
      const power = pick(step);
      if (isRest(power, step.capacityKw)) return "0";
      const fraction = (power as number) / step.capacityKw;
      const scaled = Math.pow(clamp(fraction / CAPACITY_CEILING, 0, 1), MIDDAY_GAMMA);
      return notes[Math.round(scaled * (notes.length - 1))];
    })
    .join(" ");
}

export function toPhrase(steps: Step[]): Phrase {
  const notes = degrees();
  const kept = shortenNight(steps, stepMinutesOf(steps));

  return {
    forecast: voice(kept, notes, (step) => step.forecastKw),
    actual: voice(kept, notes, (step) => step.actualKw),
    pulse: pulseFor(kept),
    kept
  };
}

/**
 * HYPERBLAM advances one step per quarter-beat, so the tempo has to be derived
 * from how long a step represents rather than set directly. Deriving it this way
 * means a day takes the same wall-clock time in both countries — NL simply plays
 * twice as many notes in the same span.
 */
export function bpmFor(stepMinutes: number, hoursPerSecond: number): number {
  return ((hoursPerSecond * 60) / stepMinutes) * 15;
}
