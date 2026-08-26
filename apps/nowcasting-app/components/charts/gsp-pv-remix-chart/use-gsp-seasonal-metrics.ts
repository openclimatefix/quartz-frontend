import { useEffect, useState } from "react";
import { NationalAggregation } from "../../map/types";
import dnoMetricsManifest from "../../../data/dno_metrics/manifest.json";

// Same shape as national_metrics.json: normalised (0-1) seasonal stats keyed by
// month -> day, each with a per-settlement-period mean and pLevel arrays. Values
// can be null where a GSP has no data for that settlement period.
type MetricValue = number | null;
export type SeasonalMetrics = {
  keys: { pLevels: string[] };
  data: Record<string, Record<string, { mean: MetricValue[]; pLevels: MetricValue[][] }>>;
};

type LoadedGspMetrics = { cap: number; metrics: SeasonalMetrics };

// Capacity-weighted average of one settlement period across GSPs, ignoring GSPs
// with no value (null/non-finite) there. Returns null when no GSP has data, so a
// single bad GSP can't drag the combined value toward zero.
const weightedValue = (
  entries: LoadedGspMetrics[],
  pick: (metrics: SeasonalMetrics) => MetricValue | undefined
): MetricValue => {
  let num = 0;
  let den = 0;
  for (const { cap, metrics } of entries) {
    const v = pick(metrics);
    if (typeof v === "number" && Number.isFinite(v)) {
      num += v * cap;
      den += cap;
    }
  }
  return den > 0 ? num / den : null;
};

// Combine one or more GSPs' normalised metrics into a single normalised metrics
// object, weighting each GSP by its installed capacity (per settlement period,
// over the GSPs that have data). Multiplying the result by the selection's total
// installed capacity then yields the capacity-weighted seasonal expectation.
const combineMetrics = (entries: LoadedGspMetrics[]): SeasonalMetrics => {
  if (entries.length === 1) return entries[0].metrics;

  const base = entries[0].metrics;
  const data: SeasonalMetrics["data"] = {};

  for (const month of Object.keys(base.data)) {
    data[month] = {};
    for (const day of Object.keys(base.data[month])) {
      const meanLen = base.data[month][day].mean.length;
      const mean = base.data[month][day].mean.map((_, sp) =>
        weightedValue(entries, (m) => m.data[month]?.[day]?.mean[sp])
      );
      const pLevels = base.data[month][day].pLevels.map((arr, k) =>
        arr.map((_, sp) => weightedValue(entries, (m) => m.data[month]?.[day]?.pLevels[k]?.[sp]))
      );

      data[month][day] = { mean, pLevels };
    }
  }

  return { keys: base.keys, data };
};

export type GspSeasonalMetrics = {
  // Capacity-weighted, normalised (0-1) metrics across the GSPs we have data for.
  metrics: SeasonalMetrics;
  // Total installed capacity of *only* the GSPs that had metrics. This is the
  // multiplier the caller should use, so a selection that mixes known GSPs with
  // "new" GSPs (>317, no metrics yet) scales the seasonal line to the known
  // portion rather than over-/under-counting.
  capacity: number;
};

type DnoManifest = Record<string, { file: string }>;

/**
 * Returns the (capacity-weighted) normalised seasonal metrics for the current
 * selection plus the capacity to scale them by, or null while loading / when no
 * metrics are available.
 *
 * - GSP aggregation: combines the selected GSPs' per-GSP metrics
 *   (public/metrics/gsp_metrics/gsp_{gspId}.json), weighted by capacity, on the
 *   fly. GSPs
 *   without a metrics file (e.g. newly added GSPs) are skipped and the effective
 *   capacity covers only the GSPs we have data for.
 * - DNO aggregation: fetches the pre-baked DNO file (public/metrics/dno_metrics/,
 *   generated
 *   by scripts/generate-dno-metrics.mjs) and scales by the DNO's current total
 *   installed capacity from the live API, extrapolating the normalised shape to
 *   the full present-day capacity.
 * - Other aggregations (Zone/National): not yet supported -> null.
 */
const useGspSeasonalMetrics = (
  gspLocationInfo?: { gspId: number; installedCapacityMw: number }[],
  aggregationLevel?: NationalAggregation,
  selectionName?: string
): GspSeasonalMetrics | null => {
  const [metrics, setMetrics] = useState<GspSeasonalMetrics | null>(null);

  const isDno = aggregationLevel === NationalAggregation.DNO;
  const totalCapacity = (gspLocationInfo || []).reduce(
    (acc, g) => acc + (g.installedCapacityMw || 0),
    0
  );
  const dnoFile = isDno
    ? (dnoMetricsManifest as DnoManifest)[selectionName || ""]?.file
    : undefined;

  // Stable dependency for the selection, disambiguated by aggregation level.
  const selectionKey = `${aggregationLevel}|${
    isDno
      ? `${selectionName}:${totalCapacity}`
      : (gspLocationInfo || [])
          .map((g) => `${g.gspId}:${g.installedCapacityMw}`)
          .sort()
          .join(",")
  }`;

  useEffect(() => {
    let cancelled = false;

    // DNO: use the pre-baked, capacity-weighted DNO metrics, scaled by the
    // DNO's current total installed capacity.
    if (isDno) {
      if (!dnoFile || !totalCapacity) {
        setMetrics(null);
        return;
      }
      fetch(`/metrics/dno_metrics/${dnoFile}`)
        .then((r) => r.json())
        .then((m) => {
          if (cancelled) return;
          setMetrics({ metrics: m as SeasonalMetrics, capacity: totalCapacity });
        })
        .catch(() => {
          if (!cancelled) setMetrics(null);
        });
      return () => {
        cancelled = true;
      };
    }

    // GSP aggregation: combine the selected GSPs' metrics on the fly.
    if (aggregationLevel !== NationalAggregation.GSP) {
      setMetrics(null);
      return;
    }

    const gsps = gspLocationInfo || [];
    if (!gsps.length) {
      setMetrics(null);
      return;
    }

    Promise.all(
      gsps.map((g) =>
        fetch(`/metrics/gsp_metrics/gsp_${g.gspId}.json`)
          .then((r) => r.json())
          .then(
            (m) =>
              ({
                cap: g.installedCapacityMw || 0,
                metrics: m as SeasonalMetrics
              } as LoadedGspMetrics)
          )
          .catch(() => null)
      )
    ).then((loaded) => {
      if (cancelled) return;
      const valid = loaded.filter((x): x is LoadedGspMetrics => !!x);
      if (!valid.length) {
        setMetrics(null);
        return;
      }
      const capacity = valid.reduce((acc, e) => acc + e.cap, 0);
      setMetrics({ metrics: combineMetrics(valid), capacity });
    });

    return () => {
      cancelled = true;
    };
    // selectionKey captures the relevant selection fields
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  return metrics;
};

export default useGspSeasonalMetrics;
