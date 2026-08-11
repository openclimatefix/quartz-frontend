import { VIEWS } from "../../constant";

/**
 * Comparison — what the map's colour means, and the one series the chart gains.
 *
 * Phase 6 §2: there are not three views. Delta was never a peer of Forecast — it shares the
 * country, the regions, the time axis and the level control with it, and differs by *what the
 * map's fill encodes*: sequential (output magnitude) becomes diverging (difference). Plain
 * forecast is simply the preset with no B side, which is why `null` is a legal selection
 * rather than a preset of its own.
 *
 * Today there is exactly one B: observed generation, which is what the existing delta view
 * compares against. "Forecast vs N-hour forecast" is the second preset over the same
 * mechanism and the full A-and-B picker is Delta v2 — deferred (contract OPEN 9), and it grows
 * in this list and in Track E's "Colour by" control, needing no new surface.
 */

export type ComparisonId = "generation";

/** No comparison is a real state, not a missing one: the plain forecast. */
export type ComparisonSelection = ComparisonId | null;

export type ComparisonPreset = {
  id: ComparisonId;
  /** Names the B side, for the control that selects it. */
  label: string;
  /** What the comparison is, for the chart header's passive echo (§5). */
  title: string;
};

export const COMPARISON_PRESETS: readonly ComparisonPreset[] = [
  { id: "generation", label: "Generation", title: "Forecast vs generation" }
];

/** What the plain-forecast option is called wherever the presets are listed alongside it. */
export const NO_COMPARISON_LABEL = "Forecast";

export const comparisonPresetOf = (id: ComparisonSelection): ComparisonPreset | undefined =>
  COMPARISON_PRESETS.find((preset) => preset.id === id);

/** The chart header's echo of the map's encoding. Authoritative control is the map cluster. */
export const comparisonTitle = (id: ComparisonSelection): string =>
  comparisonPresetOf(id)?.title ?? "National forecast";

/**
 * The `VIEWS` value a comparison selection corresponds to.
 *
 * `view` is no longer what the dashboard switches on — comparison is — but a dozen components
 * still read it (`remix-line`, `StatusBanner`, the CSV modal, both charts' reset effects), and
 * migrating them is Wave 4's cleanup rather than this track's. So the shell keeps `view` in
 * step through `setComparison`, and this is the mapping.
 */
export const viewForComparison = (id: ComparisonSelection): VIEWS =>
  id ? VIEWS.DELTA : VIEWS.FORECAST;
