# Phase 5 — Track B notes (region-type seam)

## What landed

**`components/helpers/aggregationLevels.ts`** — `deriveAggregationLevels` untouched. Two new
exports beside it:

```ts
/** Finest non-derived level in an already-derived list, or undefined. */
export const defaultLevelOf = (levels: AggregationLevel[]): AggregationLevel | undefined;
/** The region type name a country's `nationalAggregationLevel` defaults to. */
export const defaultAggregationLevel = (
  config: CountryConfig | undefined,
  regionTypes: RegionTypeCapability[] = []
): string;
```

`defaultAggregationLevel` is `defaultLevelOf(deriveAggregationLevels(…))?.regionType ?? "national"`,
so every gating rule and fallback stays in the one place. `defaultLevelOf` exists because the hook
already has a derived list and re-deriving it to pick a default would be the duplication the
contract warns about.

**`components/helpers/countryState.ts`** — `nationalAggregationLevel: string` with the contract's
doc comment; `NationalAggregation` import gone; default now `defaultAggregationLevel(config)`. The
stale comment at the old line 94 is rewritten (see the assumption below).

**`hooks/data/use-aggregation-levels.ts`** (new, exported from `hooks/data/index.ts`) —

```ts
export const useAggregationLevels = (): AggregationLevel[];
export const useCurrentAggregationLevel = (): AggregationLevel | undefined;
```

`useCurrentCountry()` + `useRegionTypes({ country })`, memoised scope, memoised result. No
`isLoading` on the return: the registry alone yields a complete usable list, and the manifest only
refines labels and level numbers. Callers wanting the manifest's loading state use `useRegionTypes`.

**Tests** — `aggregationLevels.test.ts` gains a `defaultAggregationLevel` block (GB→gsp, NL→province,
same answer with and without the manifest, national-only config→national, groupings-but-no-sub-national
config→national *not* `zone`, unconfigured→national). The existing "no boundaries → not offered"
test is strengthened with a full list assertion, satisfying the contract's obligation.
`countryState.test.ts` pins the two entry points equal. `use-aggregation-levels.test.tsx` is
MSW-over-the-real-machinery like `use-countries.test.tsx`, and covers the country-switch fallback.

## Assumptions — these need Brad

1. **The default is resolved from the registry alone, without the manifest, and I claim that is
   safe.** `defaultCountryScopedState` is synchronous and pre-hook. `deriveAggregationLevels`'s
   fallback level (0 for `national`, 10 for everything else) puts any sub-national type below
   national, so GB and NL give the same answer with and without `/countries` — pinned by a test. A
   country whose *manifest* levels ordered its region types differently from that fallback could
   start on one level and move when the manifest lands. None does today, and the hook would settle
   on the manifest's answer, so the failure mode is a level change on first load, not a wrong level.
2. **"Finest" = highest `level`, ties broken by the existing sort.** For a country with two
   non-derived types at the same level, the alphabetically-last one wins. No country has that.
3. **Derived levels can never be the default**, even where a derived level sorts finer than every
   real one (a config with only a `national` geo entry plus GB's groupings resolves to `national`,
   not `zone`). Rationale in the doc comment: a derived level's values depend on a grouping file
   that may not have loaded, so "the API serves this directly" is the safer starting state.
4. **`useCurrentAggregationLevel` returns `undefined` for one reason only** — the country has no
   registry entry. Every other miss (stored name from another country, stored name the registry has
   since dropped) resolves to the country's default. Consumers should treat `undefined` as
   "unconfigured country", not "still loading".

## Files touched outside my scope, and why

Changing the state field from the enum to `string` broke exactly three call sites at `tsc`. Each got
a one-line `as NationalAggregation` cast with a comment naming the seam. **No behaviour change** —
the enum's values are the region type names. The owning track should delete the cast as it moves the
file onto `useCurrentAggregationLevel`:

- `components/charts/gsp-pv-remix-chart/index.tsx` — `groupGspIds(level, name)`
- `components/map/color-guide-bar.tsx` — `[zone, DNO].includes(level)` (should become `level.derived`)
- `components/map/pvLatestMap.tsx` — `useMapRegionValues(level, …)` (should take an `AggregationLevel`)

Everything else compiled untouched: string-enum members are comparable to `string`, so the ~20
`level === NationalAggregation.X` comparisons still typecheck and still mean the same thing.

## What the contract did not predict

- **`.includes()` is the shape that breaks, not `===`.** Worth knowing for the remaining waves: a
  `switch` or `===` on the enum keeps compiling after the type change and will *silently* survive
  the migration. Only array membership and function parameters fail loudly. Grepping for
  `NationalAggregation` is the only way to find the rest — `tsc` will not.
- **The GB manifest's `gsp` label is "Grid Supply Point", not "GSP".** The registry's `dno`/`zone`
  labels are the short forms. So a level row rendered from `level.label` will read
  "National / DNO / Zone / Grid Supply Point", which is *not* what the current UI shows. Someone
  should decide whether that is acceptable or whether the manifest label needs a short form — it is
  a visible copy change, not a refactor artefact.
- **`countryState.ts` now imports `aggregationLevels.ts`.** Both are React-free and pull only types
  plus `config/countries`, so the "no data layer in global state init" rule still holds. Worth not
  accidentally adding an import to `aggregationLevels.ts` that breaks it.
- The `if (regionType === "gsp")` smell the brief asked me to flag: the three cast sites above are
  all of it in my dependency cone, plus `pages/index.tsx`'s delta-view forcing of
  `NationalAggregation.GSP`, which the contract already names. `presenceMetadataBridge.tsx` sends
  the value to Sentry as a string and needs no change.

## Baseline

`npx tsc --noEmit` exit 0. `npx jest` 32 suites / 898 tests green (the baseline was 30/869; one
suite and some tests came from a track running in parallel, one suite and 15 tests are mine).
