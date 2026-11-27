import { getGlobalState } from "../../components/helpers/globalState";
import { cadenceMinutesFor, cursorNow, periodForLabel } from "../time/cursor";
import type { RegionSeries, RegionSnapshot, TimeSeries } from "./types";

/** A trial-expired user keeps the past only. A UI restriction: the server still sends everything. */
export const withholdFuture = <T>(data: T, country?: string): T => {
  // Arrays (region and country lists) are not time-bearing, and `"values" in []` is true.
  if (!getGlobalState("trialExpiredAt") || typeof data !== "object" || data === null) return data;
  if (Array.isArray(data)) return data;
  // For trial expired acc cut: now - 30 min, which on 15- and 30-minute periods is also the previous period.
  const lastStart = Date.parse(cursorNow(cadenceMinutesFor(country), -30));
  const isPast = (label: string) => Date.parse(periodForLabel(label, country).start) <= lastStart;
  const d = data as unknown as TimeSeries | RegionSeries | RegionSnapshot;

  if ("values" in d && Array.isArray(d.values)) {
    return { ...d, values: d.values.filter((p) => isPast(p.timeUtc)) } as T;
  }
  if ("times" in d && Array.isArray(d.times)) {
    const keep = d.times.filter(isPast).length; // times and region arrays are index-aligned
    const cut = <V>(values: V[]) => values.slice(0, keep);
    const regions = Object.fromEntries(
      Object.entries(d.regions).map(([name, r]) => [
        name,
        {
          ...r,
          powerMw: cut(r.powerMw),
          plevelsMw:
            r.plevelsMw &&
            Object.fromEntries(Object.entries(r.plevelsMw).map(([k, values]) => [k, cut(values)]))
        }
      ])
    );
    return { ...d, times: cut(d.times), regions } as T;
  }
  // A snapshot is one instant: whole if past, empty if future.
  if ("timeUtc" in d && "regions" in d && !isPast(d.timeUtc)) return { ...d, regions: {} } as T;
  return data;
};
