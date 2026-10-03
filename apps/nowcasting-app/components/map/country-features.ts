import type { Feature, FeatureCollection } from "geojson";

import type { MapFeatureState } from "../helpers/data";

/**
 * The map draws every ENABLED country, and this is what makes one Mapbox source able to
 * carry them.
 *
 * Contract §1: every enabled country's regions are clickable and clicking one focuses its
 * country. Contract §3: the map is the ground. Both of those need several countries'
 * polygons on screen at once, and Phase 6 Track F puts them in **one** source
 * (`feature-state.ts`'s `PV_SOURCE_ID`) rather than one source per country — see
 * `docs/phase6-track-f-notes.md` for why, in short: one fill layer means one click handler,
 * one paint expression and one `removeFeatureState` sweep, none of which have to learn how
 * many countries exist.
 *
 * A shared source needs two things stamped onto every feature as it is loaded:
 *
 *  - **`country`** (`REGION_COUNTRY_PROPERTY`) — whose region this is. The click path reads
 *    it to decide whether a click crosses a country boundary; nothing else can tell, because
 *    a region id is only unique *within* a country.
 *  - **`featureKey`** (`FEATURE_KEY_PROPERTY`) — the country-qualified id Mapbox keys feature
 *    state on, via the source's `promoteId`.
 *
 * The second is the load-bearing one and the reason this module exists rather than a one-line
 * `properties.country = code` at the call site. GB keys its GSPs on the numeric `gsp_id`
 * (`buildMapGeometry`/`featureIdFor`), and any country whose API assigns numeric region ids
 * will do the same — Germany, when it lands, almost certainly does. Two countries in one
 * source with a bare `5` on each side is not a visible failure: Mapbox happily applies GB's
 * value to Germany's polygon and paints a plausible number on the wrong ground. Unmatched
 * features collide even between the countries we ship today, because `buildMapGeometry`
 * numbers them `-1, -2, -3…` starting again per collection.
 *
 * **`properties.id` is deliberately left alone.** It stays the country-local region id, which
 * is what `selectedMapRegionIds` (country-scoped state), the GSP sub-chart and the CSV all
 * speak. The namespace is a property of the *map layer*, not of the domain, and it stops at
 * this module's boundary.
 */
export const REGION_COUNTRY_PROPERTY = "country";

/** The country-qualified Mapbox feature id. See the note above. */
export const FEATURE_KEY_PROPERTY = "featureKey";

const SEPARATOR = ":";

/** Country codes are compared and stamped uppercase, as `config/countries.ts` spells them. */
const normalise = (country: string): string => country.toUpperCase();

/**
 * The Mapbox feature id for a region.
 *
 * Always a string, even where the region id is numeric: a key that is sometimes `5` and
 * sometimes `"5"` is exactly the sort of thing that works until it does not, and the
 * select-borders filter compares with `in`, which does not coerce. `featureKeyFor("GB", 5)`
 * and `featureKeyFor("gb", "5")` are the same key, which is what lets the click path build a
 * key from state (strings) and match geometry built from the API (numbers).
 */
export const featureKeyFor = (country: string, id: string | number): string =>
  `${normalise(country)}${SEPARATOR}${id}`;

/** The country half of a feature key. `""` for a string that is not one. */
export const countryOfFeatureKey = (key: string): string => {
  const index = key.indexOf(SEPARATOR);
  return index === -1 ? "" : key.slice(0, index);
};

/**
 * The region half of a feature key — what goes back into `selectedMapRegionIds`.
 *
 * Splits on the FIRST separator only, so a region whose own name contains a colon survives
 * the round trip.
 */
export const regionIdOfFeatureKey = (key: string): string => {
  const index = key.indexOf(SEPARATOR);
  return index === -1 ? key : key.slice(index + 1);
};

/**
 * Stamp one country's boundary geometry with its country and its feature keys.
 *
 * Returns `undefined` for `undefined` — the pre-arrival state, which the map draws as an
 * empty collection rather than as an absence (see `EMPTY_GEOMETRY` in `pvLatestMap.tsx`).
 *
 * The feature's top-level `id` is rewritten alongside the property. `promoteId` already makes
 * the property authoritative, so this is belt and braces; it costs nothing and it means a
 * feature read back out of `queryRenderedFeatures` cannot present two different identities.
 */
export const stampCountryFeatures = (
  country: string,
  geometry: FeatureCollection | undefined
): FeatureCollection | undefined => {
  if (!geometry) return undefined;
  const code = normalise(country);
  return {
    ...geometry,
    features: geometry.features.map((feature): Feature => {
      const key = featureKeyFor(code, (feature.properties?.id ?? feature.id) as string | number);
      return {
        ...feature,
        id: key,
        properties: {
          ...feature.properties,
          [REGION_COUNTRY_PROPERTY]: code,
          [FEATURE_KEY_PROPERTY]: key
        }
      };
    })
  };
};

/**
 * Re-key one country's feature states onto its feature keys, and record whether its level is
 * a client-side grouping.
 *
 * `grouped` travels as feature state rather than as an argument to `fillOpacityExpression`
 * because grouped-ness is now a **per-feature** fact: each country picks its own aggregation
 * level, so GB can be on its DNO rollup (bands ten times higher) while NL is on provinces in
 * the same frame. One paint expression serves both by reading the flag. See `feature-state.ts`.
 */
export const namespaceFeatureStates = (
  country: string,
  states: Map<string | number, MapFeatureState>,
  options: { grouped?: boolean } = {}
): Map<string | number, MapFeatureState> => {
  const code = normalise(country);
  const grouped = options.grouped ?? false;
  const namespaced = new Map<string | number, MapFeatureState>();
  states.forEach((state, id) => {
    namespaced.set(featureKeyFor(code, id), grouped ? { ...state, grouped } : state);
  });
  return namespaced;
};

/**
 * One collection out of several countries'.
 *
 * `undefined` when nothing has arrived at all, so the map keeps its empty source rather than
 * flashing an empty collection over one it had already drawn. A country whose boundaries are
 * still in flight simply contributes nothing yet: the countries that have landed draw
 * immediately rather than waiting for the slowest one, which matters when GB's 9 MB GSP file
 * shares a frame with NL's 220 KB provinces.
 */
export const mergeFeatureCollections = (
  collections: (FeatureCollection | undefined)[]
): FeatureCollection | undefined => {
  const present = collections.filter((collection): collection is FeatureCollection => !!collection);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return {
    type: "FeatureCollection",
    features: present.flatMap((collection) => collection.features)
  };
};

/** One feature-state map out of several countries'. Keys are already namespaced. */
export const mergeFeatureStates = (
  maps: (Map<string | number, MapFeatureState> | undefined)[]
): Map<string | number, MapFeatureState> => {
  const merged = new Map<string | number, MapFeatureState>();
  for (const map of maps) {
    map?.forEach((state, key) => merged.set(key, state));
  }
  return merged;
};
