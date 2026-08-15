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
 * in this list and in Track E's "Map shows" control, needing no new surface.
 */

export type ComparisonId = "generation";

/** No comparison is a real state, not a missing one: the plain forecast. */
export type ComparisonSelection = ComparisonId | null;

export type ComparisonPreset = {
  id: ComparisonId;
  /**
   * What the option is called in the "Map shows" control.
   *
   * Names the *encoding*, not the B side. It used to read "Generation", which composed with the
   * group label into "Colour by: Generation" — i.e. colour regions by generation output, which
   * is the one thing this option does not do. It colours them by the difference. (Brad,
   * 2026-08-15. The group label moved to "Map shows" in the same pass: the control was never
   * really about colour, it is about which data is on the map, and colour is only how.)
   *
   * With a second preset this becomes ambiguous — two options both called "Delta" — and the
   * answer is either a suffix ("Delta vs generation") or one delta option with its B side
   * chosen separately. That is Delta v2's problem; deferred with it, contract OPEN 9.
   */
  label: string;
  /** What the comparison is, for the chart header's passive echo (§5). */
  title: string;
};

export const COMPARISON_PRESETS: readonly ComparisonPreset[] = [
  { id: "generation", label: "Delta", title: "Forecast vs generation" }
];

/** What the plain-forecast option is called wherever the presets are listed alongside it. */
export const NO_COMPARISON_LABEL = "Forecast";

export const comparisonPresetOf = (id: ComparisonSelection): ComparisonPreset | undefined =>
  COMPARISON_PRESETS.find((preset) => preset.id === id);

/** The chart header's echo of the map's encoding. Authoritative control is the map cluster. */
export const comparisonTitle = (id: ComparisonSelection): string =>
  comparisonPresetOf(id)?.title ?? "National forecast";
