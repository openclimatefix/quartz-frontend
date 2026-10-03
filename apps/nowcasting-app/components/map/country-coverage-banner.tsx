import React from "react";

import useGlobalState from "../helpers/globalState";
import type { CoverageGap } from "./country-coverage";
import { CONTROL_ROW } from "./control-button";

type Reason = "no-forecast" | "no-forecast-at-cursor" | "no-actuals-at-cursor";

/**
 * `no-data` splits by map: on the forecast fill the missing thing is a forecast, on the delta
 * fill it is usually the actuals, since generation reports late (the GB stale-cache case).
 */
const reasonOf = ({ state, metric }: CoverageGap): Reason =>
  state === "no-forecast"
    ? "no-forecast"
    : metric === "delta"
    ? "no-actuals-at-cursor"
    : "no-forecast-at-cursor";

const REASON_TEXT: Record<Reason, string> = {
  "no-forecast": "No data loaded",
  "no-forecast-at-cursor": "No forecast for this time",
  "no-actuals-at-cursor": "No actuals yet for this time"
};

const REASON_TITLE: Record<Reason, string> = {
  "no-forecast": "Nothing has arrived for the whole fetched window, not just this instant.",
  "no-forecast-at-cursor":
    "No region has a forecast for this moment. Try selecting a previous period.",
  "no-actuals-at-cursor":
    "No region has reported generation for this moment yet, so there is no delta to draw. Try selecting a previous period."
};

const REASON_ORDER: Reason[] = ["no-forecast", "no-forecast-at-cursor", "no-actuals-at-cursor"];

/**
 * Country-level legibility, beside the country toggle in the header.
 *
 * Renders nothing for a country that is `ok` or still `loading` — being quiet near the
 * publishing edge is the *common* case (Phase 6 followup, Track M's brief), not an error, so it
 * must not read as an alarm. It only speaks up for `no-forecast` and `no-data`, the two cases
 * that look, from the map alone, identical to "the map is broken".
 *
 * It used to sit in the map's top-left overlay corner, which the chart card now covers. The
 * header is where countries are switched on, so a note naming one sits next to its switch.
 * `pvLatestMap` computes the gaps (it holds the per-country pipelines) and publishes them as
 * `coverageGaps`. Countries with the same gap share one entry.
 *
 * Dressed as the country toggle beside it (its `MINI_PANEL` rim around an inset well) so the
 * header reads as one family, and kept to one line at the toggle's height: the codes at full
 * strength, the reason muted. Below `sm` the reason drops to the tooltip and the codes remain.
 */
const PANEL = "flex items-center rounded-lg border border-content/10";
const WELL = `${CONTROL_ROW.replace("bg-surface-inner", "bg-surface-inset")} gap-2`;
const LINE =
  "inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-semibold text-content-muted cursor-default";
const CountryCoverageBanner: React.FC = () => {
  const [gaps] = useGlobalState("coverageGaps");

  if (gaps.length === 0) return null;

  const codesByReason = new Map<Reason, string[]>();
  for (const gap of gaps) {
    const reason = reasonOf(gap);
    codesByReason.set(reason, [...(codesByReason.get(reason) ?? []), gap.code]);
  }

  return (
    <div className={PANEL}>
      <div className={WELL}>
        {REASON_ORDER.filter((reason) => codesByReason.has(reason)).map((reason) => (
          <span key={reason} title={REASON_TITLE[reason]} className={LINE}>
            <span className="text-content">{codesByReason.get(reason)!.join(", ")}</span>
            <span className="hidden sm:inline">{REASON_TEXT[reason]}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default CountryCoverageBanner;
