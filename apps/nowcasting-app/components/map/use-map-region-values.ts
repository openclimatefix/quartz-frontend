import { useMemo } from "react";

import {
  useFocusedCountry,
  useForecastPeriod,
  useGenerationPeriod,
  useRegions
} from "../../hooks/data";
import { useMapObserver } from "./map-observer";
import { useMapGeometry } from "../../hooks/data/use-map-geometry";
import { getCountryConfig } from "../../config/countries";
import { isLegacyRegion } from "../../config/geo-aliases";
import {
  valueRegionTypeFor as resolveValueRegionType,
  type AggregationLevel
} from "../helpers/aggregationLevels";
import type { Scope } from "../../lib/domain/types";
import useGlobalState from "../helpers/globalState";
import { buildMapFeatureStates, type MapFeatureState } from "../helpers/data";
import { slotForInstant } from "../../lib/time/cursor";

/**
 * The map's value pipeline, in one hook.
 *
 * Three things it deliberately does *not* do, each of which was costing the old map a
 * measurable amount of the felt lag:
 *
 * 1. **It does not refetch when the user scrubs.** The `period` endpoints are asked for no
 *    window at all, so the SWR key carries no timestamp and `selectedISOTime` never reaches
 *    the network — the API's own default (2 days either side, floored to 6 hours) is both
 *    wider than anything we would pin and the window its cache is pre-warmed on. The v0
 *    `useGetGspForecast(selectedTime)` set `start == end == targetTime` and issued a fresh
 *    request on every tick of the scrubber.
 * 2. **It does not rebuild geometry when the numbers move.** `geometry` depends only on the
 *    aggregation level and the region list; values leave via `featureStates` and are applied
 *    with `setFeatureState`.
 * 3. **It does not flatten the three snapshot states.** See `MapFeatureState.dataState`.
 *
 * Every hook it calls is keyed, so the forecast map and the delta map calling this at the
 * same time is one set of requests, not two — and since Phase 5 that is true of the boundary
 * assets too, which are cached per URL in `lib/geo/assets.ts`.
 */
export type MapRegionValues = {
  featureStates: Map<string | number, MapFeatureState>;
  /**
   * `undefined` until the boundary file for this level has been fetched. Phase 5 made this
   * asynchronous; consumers add their Mapbox source once with an empty `FeatureCollection`
   * and `setData` when this arrives. See `pvLatestMap.tsx`.
   */
  geometry: GeoJSON.FeatureCollection | undefined;
  /** `{ published, expected, isPartial }` — a partial newest slot is normal, not a fault. */
  coverage: { published: number; expected: number; isPartial: boolean };
  /**
   * Whether the values pipeline delivered anything at all — at least one region carried by the
   * forecast payload.
   *
   * **Consumers must gate their failure and loading states on this, not on `featureStates.size`.**
   * Feature states are built from the *region list*, so they are fully populated the moment
   * `/regions` resolves, whether or not a single forecast value ever arrived. A `!featureStates.size`
   * guard is therefore false exactly when it is needed: on a `/forecasts/period` failure with the
   * region list intact, every region paints as `power: 0` and the map renders silently uncoloured.
   * That is how a 503 reached the UI as "boundaries, no fill, no message".
   *
   * `power: 0` cannot carry this signal either — at night every region genuinely *is* zero, so an
   * all-zero map and a no-data map are indistinguishable by value. Coverage counts whether the
   * region was *published*, which is the distinction `dataState` exists to preserve.
   */
  hasValues: boolean;
  /**
   * Total installed capacity in MW, summed over the regions that are actually real.
   *
   * **The API's regions are not a partition**, and an earlier version of this comment
   * claimed they were. The v1 API serves "all" regions, which includes merged and legacy
   * spellings of the same physical GSP kept for backward compatibility of client scripts.
   * Summing all 338 double-counts six of them: 22,588 MW against a national 21,905 MW,
   * 683 MW (3.1 %) over.
   *
   * The definitive GSP set is the NESO boundary file (Brad's call), so this sum excludes
   * the regions `LEGACY_REGIONS` names, exactly as the geometry and the feature-state join
   * already did — one rule about what is real, applied in all three places. The remaining
   * 332 give **21,783 MW**, 122 MW (0.56 %) *under* national.
   *
   * That residual is a coverage gap, not a double-count, and is deliberately left: it is
   * GSPs the boundary file models which the API does not publish separately (Seabank, and
   * `grem_p`). Closing it needs data, not arithmetic — do not "fix" it by scaling here.
   */
  nationalCapacityMw: number;
  /**
   * The display name of the observer this country's `actual` (and therefore its delta) was
   * read from — "PV Live Estimated" for GB. `undefined` until the manifest resolves.
   *
   * Carried out of the values pipeline rather than looked up again by the popup, so the label
   * on screen cannot drift from the stream the numbers came from. See `map-observer.ts`.
   */
  observerLabel: string | undefined;
  isLoading: boolean;
  error: unknown;
};

const SOURCE = "solar";

/**
 * The region type whose values feed a level.
 *
 * A derived level rolls up its `source` region type (GB's DNO groups GSPs). A non-derived
 * level is served by the API directly, so it is its own source — which is what makes NL work
 * without a guard: `province` asks for provinces, where the old hardcoded `"gsp"` asked for
 * something NL does not have.
 *
 * `national` returns `null`, disabling every fetch. Not a branch on region-type identity for
 * presentation purposes — it is a hard API constraint: `forecasts/period` and
 * `generation/period` 400 on `region_type=national`. The old `NationalAggregation.national`
 * level drew the national outline from a `national_gsp_zone.json` grouping that summed every
 * GSP; Phase 5 ships no such grouping and `measuringUnit.tsx` does not offer the level, so
 * there is nothing to preserve. If the national map level is ever wanted back it needs a
 * values path of its own (a synthetic all-regions group, or the snapshot endpoints).
 */
const valueRegionTypeFor = (level: AggregationLevel | undefined, country: string | null) =>
  resolveValueRegionType(level, getCountryConfig(country));

export const useMapRegionValues = (
  level: AggregationLevel | undefined,
  /** The shared cursor, not a country slot — resolved to one below. */
  cursorTime: string,
  /**
   * Whose values these are. Defaults to the focused country; the map passes it explicitly,
   * one instance of this hook per enabled country (Phase 6 Track F).
   */
  countryCode?: string
): MapRegionValues => {
  const focusedCountry = useFocusedCountry();
  const country = countryCode ?? focusedCountry;
  const [cursorNow] = useGlobalState("timeNow");

  // The cursor is one instant on the finest *enabled* country's grid; this country's data is
  // published on its own. Resolve both before anything is looked up, or a GB map read at NL's
  // 16:15 finds nothing in every region and draws as a blank country rather than an error.
  // Track F's fan-out gives each country's layer its own instance, and each resolves its own.
  const targetSlot = slotForInstant(cursorTime, country);
  const timeNow = slotForInstant(cursorNow, country);

  const regionType = valueRegionTypeFor(level, country);

  const scope: Scope | null = useMemo(
    () => (country && regionType ? { country, source: SOURCE, regionType } : null),
    [country, regionType]
  );

  // No window at all, deliberately. `/forecasts/period` and `/generation/period` both default
  // to **2 days before → 2 days after now, floored to 6 hours**, and are "served entirely from
  // a pre-warmed cache (one key per region)" — so the default window is the window that is
  // actually warmed, and asking for our own risks missing it as well as truncating.
  //
  // The forecast horizon is a per-country fact (GB publishes 36h ahead, NL 48h), so ANY end we
  // pin is wrong for somebody. Take whatever the API has. The old
  // `{ start: getEarliestForecastTimestamp(), end: getFurthestForecastTimestamp() }` computed a
  // start identical to the default and an end of now +1 day — clipping 6–12h off GB's horizon
  // and 18–24h off NL's. Inherited from v0 with no rationale; see docs/phase4-track-g-notes.md.
  const window = {};

  const regions = useRegions(scope);
  const forecast = useForecastPeriod(scope, window);

  // The `observer` query param is optional, and the API defaults it to `pvlive_in_day` — GB's
  // in-day observer. Omitting it therefore works by accident for GB and 400s for everyone
  // else: "Observer 'pvlive_in_day' is not available for NL solar. Available: ['ned_nl']".
  // Track F's fan-out is what surfaced it, because generation is now fetched for every
  // *enabled* country rather than only the focused one.
  //
  // So name it, from the manifest, never from a constant — and hold the request until it is
  // known rather than letting the default fire and fail.
  //
  // *Which* of the manifest's observers used to be `[0]`, i.e. serving order. It is now the
  // registry's `mapObserver`, resolved against the manifest by `useMapObserver`, which also
  // hands back the label the legend and popup put on screen. Same observer for GB as before
  // (PV Live Estimated); the difference is that something chose it and something says so.
  const mapObserver = useMapObserver(scope);
  const observer = mapObserver.observer?.name;
  const generation = useGenerationPeriod(observer ? scope : null, { ...window, observer });

  // Geometry (and, for a derived level, its grouping file) is fetched rather than bundled
  // since Phase 5. `groupings` comes back on the same object because the two must agree:
  // rolling values up with one level's groupings onto another level's polygons is exactly
  // the out-of-order failure `useMapGeometry` guards against.
  const geo = useMapGeometry(level, regions.data, country);

  const featureStates = useMemo(
    () =>
      buildMapFeatureStates(
        level,
        {
          regions: regions.data,
          forecast: forecast.data,
          generation: generation.data,
          targetTime: targetSlot,
          timeNow
        },
        { groupings: geo.groupings, country }
      ),
    [
      level,
      regions.data,
      forecast.data,
      generation.data,
      targetSlot,
      timeNow,
      geo.groupings,
      country
    ]
  );

  const coverage = useMemo(() => {
    const expected = regions.data?.map((region) => region.name) ?? [];
    const published = expected.filter((name) => forecast.data?.regions[name] !== undefined).length;
    return { published, expected: expected.length, isPartial: expected.length > published };
  }, [regions.data, forecast.data]);

  const nationalCapacityMw = useMemo(
    () =>
      (regions.data ?? [])
        .filter((region) => !isLegacyRegion(country, region.name))
        .reduce((total, region) => total + (region.capacityMw ?? 0), 0),
    [regions.data, country]
  );

  return {
    featureStates,
    geometry: geo.geometry,
    coverage,
    hasValues: coverage.published > 0,
    nationalCapacityMw,
    observerLabel: mapObserver.label,
    // `mapObserver` counts: until the manifest names this country's observer the generation
    // request is deliberately not made, and without this the map would report itself loaded
    // while still missing every observed value.
    isLoading:
      regions.isLoading ||
      forecast.isLoading ||
      mapObserver.isLoading ||
      generation.isLoading ||
      geo.isLoading,
    error: forecast.error ?? generation.error ?? regions.error ?? geo.error
  };
};

export default useMapRegionValues;
