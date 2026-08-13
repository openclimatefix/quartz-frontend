import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";

import { useAggregationLevels, useCurrentAggregationLevel } from "../../hooks/data";
import { useEnabledCountries } from "../../hooks/data/use-countries";
import { defaultLevelOf } from "../helpers/aggregationLevels";
import type { MapFeatureState } from "../helpers/data";
import {
  mergeFeatureCollections,
  mergeFeatureStates,
  namespaceFeatureStates,
  stampCountryFeatures
} from "./country-features";
import {
  computeCountryCoverage,
  EMPTY_COUNTRY_COVERAGE,
  type CountryCoverage
} from "./country-coverage";
import useMapRegionValues from "./use-map-region-values";

/**
 * The map's fan-out over the enabled countries.
 *
 * Contract §1 and §3: the map draws every *enabled* country, not just the focused one, and
 * every one of their regions is clickable. This is the hook that makes that true, and it is
 * the piece Track A and Track D both named and neither built.
 *
 * ---------------------------------------------------------------------------------------
 * WHY ONE SOURCE RATHER THAN ONE PER COUNTRY
 * ---------------------------------------------------------------------------------------
 * Every country's polygons go into the single `PV_SOURCE_ID` source, merged. The alternative —
 * a source and a fill/border/select-border layer trio per country — was rejected because it
 * makes the count of countries visible to everything downstream: the click handler would
 * register per layer, the select-borders filter would have to be set on the right one,
 * `applyFeatureStates`'s `removeFeatureState` sweep would have to run per source, and
 * `map.tsx`'s satellite `beforeId` search would have to know which of N layers is bottom-most.
 * Germany would then be a code change in five places, which is exactly what
 * `config/countries.ts` says adding a country must not be.
 *
 * One source costs one thing: feature ids must be unique across countries, which they are not
 * naturally (GB keys GSPs on a numeric id starting at 1, and unmatched polygons are numbered
 * `-1, -2…` per collection). `country-features.ts` namespaces them, and that is the whole of
 * the price.
 *
 * ---------------------------------------------------------------------------------------
 * WHY CHILD COMPONENTS
 * ---------------------------------------------------------------------------------------
 * Each country needs its own `useMapRegionValues` — its own level, its own scope, its own
 * boundary fetch — and the enabled set is variable-length, which hook rules forbid iterating
 * over. So each country gets a component that calls the hooks and reports upward, and this
 * hook returns those components for the caller to render. They render `null`; they exist for
 * their hooks.
 *
 * ---------------------------------------------------------------------------------------
 * WHY THREE RECORDS AND NOT ONE
 * ---------------------------------------------------------------------------------------
 * Geometry, values and status are stored separately **on purpose**. The map calls `setData`
 * only when the merged geometry's identity changes, and that identity has to survive a value
 * tick — otherwise every scrub step re-parses and re-tessellates every country's boundaries,
 * which is the exact cost Phase 5 spent itself removing. Merging out of one combined record
 * would give the geometry a new identity whenever a number moved. Three records, three
 * `useMemo`s, and geometry only changes when geometry changes.
 */

/**
 * What one country contributes, after namespacing.
 *
 * `coverage` is the per-cursor legibility fact (Phase 6 followup, Track M) — computed once per
 * country here, alongside the same values pipeline that already builds `hasValues`, rather than
 * `deltaMap`/`pvLatestMap` each re-deriving it from the merged, namespaced feature-state map.
 * See `country-coverage.ts` for what it distinguishes and why.
 */
export type CountryStatus = {
  nationalCapacityMw: number;
  hasValues: boolean;
  isLoading: boolean;
  error: unknown;
  coverage: CountryCoverage;
};

const EMPTY_STATUS: CountryStatus = {
  nationalCapacityMw: 0,
  hasValues: false,
  isLoading: false,
  error: undefined,
  coverage: EMPTY_COUNTRY_COVERAGE
};

export type EnabledCountryMapData = {
  /**
   * Every enabled country's boundaries in one collection, each feature stamped with its
   * country and a country-qualified key. `undefined` until the first country's file lands.
   *
   * The identity is stable across value changes — see the note above; the map's
   * `appliedGeometryRef` compares on it.
   */
  geometry: FeatureCollection | undefined;
  /** Every enabled country's values, keyed by country-qualified feature key. */
  featureStates: Map<string | number, MapFeatureState>;
  /** Installed capacity per country code, for the "% of national" popup. */
  capacityByCountry: Record<string, number>;
  /** True while ANY enabled country is still loading. */
  isLoading: boolean;
  /**
   * True when ANY enabled country delivered values. The failure state is gated on this, so
   * one country's 503 does not blank a map that is drawing another country perfectly well.
   */
  hasValues: boolean;
  /** The first error any country reported, or `undefined`. */
  error: unknown;
  /**
   * Per-country status, keyed by country code, for every currently enabled country (falling
   * back to `EMPTY_STATUS` for one that has not reported yet). This is the per-country
   * breakdown the merged `hasValues`/`isLoading`/`error` above deliberately discard — added for
   * `country-coverage-banner.tsx`, which needs to say which country has nothing to draw, not
   * just whether any of them do.
   */
  countryStatus: Record<string, CountryStatus>;
  /** Render these. They are the per-country hook instances; they draw nothing themselves. */
  loaders: React.ReactNode;
};

type LoaderProps = {
  country: string;
  cursorTime: string;
  finestLevel: boolean;
  onGeometry: (country: string, geometry: FeatureCollection | undefined) => void;
  onStates: (country: string, states: Map<string | number, MapFeatureState>) => void;
  onStatus: (country: string, status: CountryStatus) => void;
  onUnmount: (country: string) => void;
};

const CountryMapLayer: React.FC<LoaderProps> = ({
  country,
  cursorTime,
  finestLevel,
  onGeometry,
  onStates,
  onStatus,
  onUnmount
}) => {
  const levels = useAggregationLevels(country);
  const currentLevel = useCurrentAggregationLevel(country);
  const finest = useMemo(() => defaultLevelOf(levels), [levels]);
  // The delta map is single-region-level only and takes the country's finest level; the
  // forecast map takes whatever level that country is on. Both are per country now: the
  // level is country-keyed state, so GB being on its DNO rollup says nothing about NL.
  const level = finestLevel ? finest : currentLevel;

  const values = useMapRegionValues(level, cursorTime, country);

  const geometry = useMemo(
    () => stampCountryFeatures(country, values.geometry),
    [country, values.geometry]
  );
  const grouped = level?.derived ?? false;
  const states = useMemo(
    () => namespaceFeatureStates(country, values.featureStates, { grouped }),
    [country, values.featureStates, grouped]
  );
  // Off the UN-namespaced states — the namespace is a map-layer concern (see
  // `country-features.ts`) and has no bearing on `dataState`/`hasDelta`, which is all this
  // reads. Computed here, once per country, rather than by each map re-scanning the merged set.
  const coverage = useMemo(
    () => computeCountryCoverage(values.featureStates),
    [values.featureStates]
  );
  const status = useMemo<CountryStatus>(
    () => ({
      nationalCapacityMw: values.nationalCapacityMw,
      hasValues: values.hasValues,
      isLoading: values.isLoading,
      error: values.error,
      coverage
    }),
    [values.nationalCapacityMw, values.hasValues, values.isLoading, values.error, coverage]
  );

  useEffect(() => onGeometry(country, geometry), [country, geometry, onGeometry]);
  useEffect(() => onStates(country, states), [country, states, onStates]);
  useEffect(() => onStatus(country, status), [country, status, onStatus]);
  // Its own effect with no other dependencies, so it fires on unmount (or a country change)
  // and not on every value tick.
  useEffect(() => () => onUnmount(country), [country, onUnmount]);

  return null;
};

export const useEnabledCountryMapData = (
  cursorTime: string,
  options: { finestLevel?: boolean } = {}
): EnabledCountryMapData => {
  const finestLevel = options.finestLevel ?? false;
  // ---------------------------------------------------------------------------------------
  // `useEnabledCountries()`, NOT `useEnabledCountryListings()` — deliberately, against what
  // the contract and Track A's notes both say. Verified 2026-08-11, and it matters:
  //
  // The listings hook intersects enabled with **entitled**, and the Auth0 country claim does
  // not exist on the tenant yet — `lib/api/auth/entitlement.ts` says so in its opening
  // paragraph, and `readCountryClaim` returns `[]` for every real session today. Fanning the
  // map out over it would draw **no countries at all** in production, while the chart (which
  // follows `useFocusedCountry()` and is not entitlement-gated) carried on showing GB. A
  // blank map next to a working chart, from a claim nobody has shipped.
  //
  // `useEnabledCountries()` is enabled ∩ configured: `setEnabledCountries` drops codes with
  // no registry entry, refuses to empty the set, and always keeps the focused country in it.
  // It is synchronous with no manifest behind it, which is the other reason to prefer it —
  // the map draws from the first frame rather than waiting on `/countries`.
  //
  // Entitlement is still enforced where it can wait for the claim: the header toggle will not
  // enable a country the user has no access to. When the claim lands, the durable fix is for
  // `setEnabledCountries` to drop unentitled codes — one place, and every consumer including
  // this one inherits it — rather than for each fan-out to filter for itself.
  // ---------------------------------------------------------------------------------------
  const codes = useEnabledCountries();

  const [geometryByCountry, setGeometryByCountry] = useState<
    Record<string, FeatureCollection | undefined>
  >({});
  const [statesByCountry, setStatesByCountry] = useState<
    Record<string, Map<string | number, MapFeatureState>>
  >({});
  const [statusByCountry, setStatusByCountry] = useState<Record<string, CountryStatus>>({});

  // All three setters bail when the value is identical, so a child re-reporting the same
  // object does not re-render the map. Stable identities, so the children's effects do not
  // re-fire on every parent render.
  const onGeometry = useCallback((country: string, geometry: FeatureCollection | undefined) => {
    setGeometryByCountry((previous) =>
      previous[country] === geometry ? previous : { ...previous, [country]: geometry }
    );
  }, []);
  const onStates = useCallback((country: string, states: Map<string | number, MapFeatureState>) => {
    setStatesByCountry((previous) =>
      previous[country] === states ? previous : { ...previous, [country]: states }
    );
  }, []);
  const onStatus = useCallback((country: string, status: CountryStatus) => {
    setStatusByCountry((previous) =>
      previous[country] === status ? previous : { ...previous, [country]: status }
    );
  }, []);
  const onUnmount = useCallback((country: string) => {
    const drop = <T,>(previous: Record<string, T>): Record<string, T> => {
      if (!(country in previous)) return previous;
      const next = { ...previous };
      delete next[country];
      return next;
    };
    setGeometryByCountry(drop);
    setStatesByCountry(drop);
    setStatusByCountry(drop);
  }, []);

  const geometry = useMemo(
    () => mergeFeatureCollections(codes.map((code) => geometryByCountry[code])),
    [codes, geometryByCountry]
  );

  const featureStates = useMemo(
    () => mergeFeatureStates(codes.map((code) => statesByCountry[code])),
    [codes, statesByCountry]
  );

  const status = useMemo(() => {
    const statuses = codes.map((code) => statusByCountry[code] ?? EMPTY_STATUS);
    return {
      capacityByCountry: Object.fromEntries(
        codes.map((code, index) => [code.toUpperCase(), statuses[index].nationalCapacityMw])
      ),
      isLoading: statuses.some((entry) => entry.isLoading),
      hasValues: statuses.some((entry) => entry.hasValues),
      error: statuses.find((entry) => entry.error !== undefined)?.error,
      countryStatus: Object.fromEntries(codes.map((code, index) => [code, statuses[index]]))
    };
  }, [codes, statusByCountry]);

  const loaders = useMemo(
    () =>
      codes.map((code) => (
        <CountryMapLayer
          key={code}
          country={code}
          cursorTime={cursorTime}
          finestLevel={finestLevel}
          onGeometry={onGeometry}
          onStates={onStates}
          onStatus={onStatus}
          onUnmount={onUnmount}
        />
      )),
    [codes, cursorTime, finestLevel, onGeometry, onStates, onStatus, onUnmount]
  );

  return { geometry, featureStates, ...status, loaders };
};

export default useEnabledCountryMapData;
