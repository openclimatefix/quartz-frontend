import React, { useMemo } from "react";

import { decideCountryCoverage, type CountryCoverageState } from "./country-coverage";
import type { CountryStatus } from "./use-enabled-country-map-data";

type Gap = { code: string; state: "no-forecast" | "no-data" };

const REASON_TEXT: Record<Gap["state"], string> = {
  "no-forecast": "no forecast data",
  "no-data": "nothing published yet"
};

const REASON_TITLE: Record<Gap["state"], (code: string) => string> = {
  "no-forecast": (code) =>
    `${code}: nothing has arrived for the whole fetched window, not just this instant.`,
  "no-data": (code) =>
    `${code}: no region has data for this moment yet. Try scrubbing further back.`
};

type CountryCoverageBannerProps = {
  /** `EnabledCountryMapData.countryStatus` — one entry per currently enabled country. */
  countryStatus: Record<string, CountryStatus>;
  /**
   * Which per-cursor fact decides "nothing to draw right now": the delta map cares about a
   * computable delta, the forecast map about a published forecast value. See
   * `CountryCoverage` in `country-coverage.ts`.
   */
  metric: "value" | "delta";
};

/**
 * Country-level legibility for the map's control-overlay corner.
 *
 * Renders nothing for a country that is `ok` or still `loading` — this is deliberately quiet
 * near the publishing edge is the *common* case (Phase 6 followup, Track M's brief), not an
 * error, so it must not compete with the control panel or read as an alarm. It only speaks up
 * for `no-forecast` and `no-data`, i.e. exactly the two cases that look, from the map alone,
 * identical to "the map is broken".
 *
 * Lives in `Map`'s `controlOverlay` slot (top-left, `pointer-events-auto` inside a
 * `pointer-events-none` wrapper) — the slot `deltaMap`/`pvLatestMap` already reserve and have
 * passed `() => null` to since Wave 4, when the per-map time readout that used to live there
 * moved to the shell's cursor readout. Reusing it rather than adding a second absolutely
 * positioned layer.
 */
const CountryCoverageBanner: React.FC<CountryCoverageBannerProps> = ({ countryStatus, metric }) => {
  const gaps = useMemo<Gap[]>(() => {
    const entries: Gap[] = [];
    for (const [code, status] of Object.entries(countryStatus)) {
      const anyAtCursor =
        metric === "value" ? status.coverage.anyValueAtCursor : status.coverage.anyDeltaAtCursor;
      const state: CountryCoverageState = decideCountryCoverage({
        isLoading: status.isLoading,
        hasValues: status.hasValues,
        anyAtCursor
      });
      if (state === "no-forecast" || state === "no-data") entries.push({ code, state });
    }
    // Stable order regardless of fetch timing, so the row does not reflow as countries report in.
    return entries.sort((a, b) => a.code.localeCompare(b.code));
  }, [countryStatus, metric]);

  if (gaps.length === 0) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      {gaps.map(({ code, state }) => (
        <div
          key={code}
          title={REASON_TITLE[state](code)}
          className="rounded bg-mapbox-black-700/80 px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-ocf-gray-600 shadow"
        >
          {code} · {REASON_TEXT[state]}
        </div>
      ))}
    </div>
  );
};

export default CountryCoverageBanner;
