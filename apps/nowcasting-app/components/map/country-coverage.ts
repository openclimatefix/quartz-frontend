import type { MapFeatureState } from "../helpers/data";

/**
 * Country-level legibility, not region-level. See `docs/phase6-followup-track-m-notes.md` for
 * the debugging session this exists to answer: GB's per-GSP generation cache was ~7 hours
 * stale, so no GB region had a computable delta at the cursor, and the delta map correctly
 * painted every GB polygon transparent — "no delta" rendered identically to "the map is
 * broken". The only signal was per-region (hover a GSP, read "no delta yet"); nothing said
 * *the whole country* had nothing to draw at this instant.
 *
 * This module is the pure decision the presentation layer (`country-coverage-banner.tsx`)
 * renders. It distinguishes three states that all look the same from the map alone:
 *
 *  - **`loading`** — still fetching, nothing delivered yet. Must never be reported as
 *    "no-data": a spinner-shaped answer to what is actually a staleness question is worse
 *    than saying nothing, and a country that is merely slow is not a country with a gap.
 *  - **`no-forecast`** — the values pipeline resolved and delivered NOTHING at all, over the
 *    whole fetched window (`MapRegionValues.hasValues` false). This is a country-wide gap:
 *    every region, every timestamp. It usually means a request failed for this country alone
 *    (which the top-level `error`/`hasValues` gate in `deltaMap`/`pvLatestMap` will not catch,
 *    since that gate is OR'd across every enabled country — one country's 503 must not blank
 *    a map that is drawing another country perfectly well).
 *  - **`no-data`** — the pipeline delivered values somewhere in the fetched window, but no
 *    region has the fact this map cares about (a published forecast, or a computable delta)
 *    AT THE CURSOR'S instant. This is the GB-cache case: normal, common near the publishing
 *    edge (the recent past or the future), and not an error.
 *  - **`ok`** — at least one region has the fact at the cursor. Nothing to say.
 */
export type CountryCoverageState = "ok" | "loading" | "no-forecast" | "no-data";

export type CountryCoverageFacts = {
  /** Still fetching, with nothing delivered yet — see `MapRegionValues.isLoading`. */
  isLoading: boolean;
  /**
   * Whether the values pipeline delivered anything at all, over the whole fetched window —
   * `MapRegionValues.hasValues` verbatim. False here is a country-wide gap, not an instant one.
   */
  hasValues: boolean;
  /**
   * Whether at least one of this country's regions carries the fact this map cares about AT
   * THE CURRENT CURSOR instant: a published forecast value for `pvLatestMap`
   * (`dataState === "value"`), or a computable delta for `deltaMap` (`hasDelta`).
   */
  anyAtCursor: boolean;
};

/** The whole decision, in one place so it has one test rather than one per caller. */
export const decideCountryCoverage = ({
  isLoading,
  hasValues,
  anyAtCursor
}: CountryCoverageFacts): CountryCoverageState => {
  // Loading is checked first and gated on `!hasValues`, matching the convention the top-level
  // `error && !hasValues` / `isLoading && !hasValues` gates in deltaMap/pvLatestMap already
  // use: once anything has arrived, a background refetch is not "loading" any more, it is
  // just data that might update.
  if (isLoading && !hasValues) return "loading";
  if (!hasValues) return "no-forecast";
  if (!anyAtCursor) return "no-data";
  return "ok";
};

/** One country's per-cursor facts, derived from its (un-namespaced) feature states. */
export type CountryCoverage = {
  anyValueAtCursor: boolean;
  anyDeltaAtCursor: boolean;
};

export const EMPTY_COUNTRY_COVERAGE: CountryCoverage = {
  anyValueAtCursor: false,
  anyDeltaAtCursor: false
};

/**
 * Scans one country's feature states once for both facts a map might need, rather than making
 * each map re-derive its own — the states are the shared source of the coverage vocabulary
 * (`dataState`, `hasDelta`) that `buildRegionValues` already decided.
 */
export const computeCountryCoverage = (
  states: Map<string | number, MapFeatureState>
): CountryCoverage => {
  let anyValueAtCursor = false;
  let anyDeltaAtCursor = false;
  for (const state of states.values()) {
    if (state.dataState === "value") anyValueAtCursor = true;
    if (state.hasDelta) anyDeltaAtCursor = true;
    if (anyValueAtCursor && anyDeltaAtCursor) break;
  }
  return { anyValueAtCursor, anyDeltaAtCursor };
};
