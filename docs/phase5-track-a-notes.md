# Phase 5 — Track A notes (assets, groupings, aliases, registry geometry)

Verified at hand-off: `npx tsc --noEmit` exit 0; `npx jest config/geo-aliases.test.ts` 17/17 green;
`data.reconciliation.test.ts` 10/10 green. Full suite left for the wave boundary, as instructed.

---

## 1. The NESO-canonical rule — read this first, it changes what the contract says

**From Brad, mid-track: `GSP_regions_4326_20260209.json` (362 features) is the definitive GSP set.
It defines which GSPs we care about, full stop.** The v1 API's region list is *not* the thing to
match. The API serves "all" regions — including merged and legacy spellings of the same physical
GSP — purely so existing client scripts keep working. A region the NESO file does not model is
legacy: **it is not a region we are failing to draw.**

This inverts the direction of the whole exercise. The contract's Seam 2 and its test obligation
("GB 355/362 features and 332/338 regions before aliases, 338/338 after") are written region-side —
get every API region drawn. Under the new rule the meaningful measure is **feature-side**: of the
362 definitive GSPs, how many does the API give us a value for. The old 338/338 target is
explicitly *not* something to achieve; reaching it required aliasing legacy duplicates into
existence, which double-draws ground and inflates the national total. **The contract's test
obligation should be rewritten accordingly.**

Two direct consequences, both good:

- **The alias map is now empty for GB.** All six entries turned out to be split/merge duplicates
  rather than naming disagreements, and moved to a new `LEGACY_REGIONS` list.
- **The 683 MW national over-count resolves.** See §4.

## 2. The contract's other factual error: carr_1 / fidf_1 is backwards

The contract says the 2026 file

> merges `brle_1|flee_1` and `iver_1|iver_6` where the API splits them, and **splits
> `carr_1`/`fidf_1` where the API merges them**.

The second half is the wrong way round. Measured:

- The boundary file carries a **single merged** feature `CARR_1|FIDF_1`. There is no `CARR_1`
  feature and no `FIDF_1` feature.
- The API serves **all three** — `carr_1` (#56), `fidf_1` (#122) and merged `carr_1|fidf_1` (#351).

So `carr_1` and `fidf_1` are the ones with no feature. This makes the pair structurally identical
to the contract's "API serves both sides of five GSP splits" list rather than the exception it is
currently presented as — i.e. it is one more instance of the same legacy-duplicate pattern, which
is exactly why Brad's rule disposes of it cleanly. **Correct the contract prose.**

## 3. Measured join rates, both directions

Against the shipped `public/geo/gb/gsp.json`. None of these came from the contract; all were
measured after the rule changed.

| Measure | Value |
|---|---|
| Features shipped | **362** (carrying **335** distinct join keys) |
| Features drawn by an API region | **355 / 362** |
| Distinct keys drawn | **332 / 335** |
| Feature keys with no API region | **3** — `grem_p`, `off_nets(unassigned)`, `seab1` |
| API regions total | 338 |
| API regions that are real (non-legacy) | **332**, and **332/332 draw** |
| API regions that are legacy, not drawn | **6** (§4) |
| Aliases required | **0** |
| NL provinces | **12/12**, no aliases, no legacy |

22 keys appear on more than one feature (27 extra features); `off_nets(unassigned)` alone is five.
A multi-part GSP is legitimately several polygons under one key, which is why 362 features carry
only 335 keys and why the test asserts both the raw and the deduplicated figure — otherwise a
change in polygon splitting could mask a change in which GSPs have data.

**The three undrawn feature keys.** `off_nets(unassigned)` is the file's placeholder for unassigned
network and was never a GSP. `grem_p` (Gremista) has no v1 region under any spelling — I checked
for near-misses, there are none. `seab1` is undrawn *on purpose*: the API publishes Seabank only
inside the legacy merged `seab1|safo_1`, and `safo_1` is served separately and is real, so
aliasing the merged region onto `seab1` would paint the combined Seabank+South-Fields figure onto
Seabank while `safo_1` also drew its own. There is no honest value to put on `seab1`.

## 4. The legacy list, and the capacity number

`LEGACY_REGIONS.GB` in `config/geo-aliases.ts` — six API regions, served for backward
compatibility, deliberately not drawn and deliberately excluded from any total:

| legacy region | gsp_id | capacity | what is real instead, per the NESO file |
|---|---|---|---|
| `carr_1` | 56 | 19.9 MW | `carr_1\|fidf_1` — the file merges the pair |
| `fidf_1` | 122 | 53.7 MW | `carr_1\|fidf_1` — same |
| `brle_1\|flee_1` | 41 | 461.1 MW | `brle_1` + `flee_1` — the file splits them |
| `iver_1\|iver_6` | 158 | 34.9 MW | `iver_1` + `iver_6` — the file splits them |
| `seab1\|safo_1` | 257 | 229.8 MW | `safo_1` (and `seab1` stays undrawn, above) |
| `actl_2\|cbnk_h\|gree_h\|peri_h\|wesa_h` | 4 | 5.3 MW | the `powe_h` six-way spelling (#350) |

### GB national capacity — MEASUREMENT ONLY, no code changed

| | MW | vs national 21,905 MW |
|---|---|---|
| All 338 API regions (today's behaviour) | **22,588** | **+683 MW / +3.12 %** |
| The 332 real regions only | **21,783** | **−122 MW / −0.56 %** |

**Brad's rule resolves the over-count.** The +683 MW the contract pins is accounted for, to the MW,
by exactly the six legacy regions. What remains is a −122 MW *shortfall* (0.56 %), which is a
different and far more ordinary problem: it is the capacity of GSPs the boundary file models but
the API does not publish separately — principally Seabank, plus `grem_p`. That is a data-coverage
gap, not a double-count, and it is small enough to be uncontroversial.

I did not act on this. Per instruction, `useMapRegionValues` and `components/helpers/data.ts` were
not touched; the capacity decision is Brad's.

### Prose for the coordinator to apply to files I do not own

For `useMapRegionValues`'s `nationalCapacityMw` doc comment, which currently claims the API's
regions "*are* a partition, unlike GB's DNO groupings":

> They are not a partition. The v1 API serves "all" GSP regions, which includes merged and legacy
> spellings of the same physical GSP for backward compatibility, so summing every region
> double-counts six of them and lands 683 MW (3.1 %) over the national figure. The definitive GSP
> set is the NESO boundary file; `LEGACY_REGIONS` in `config/geo-aliases.ts` names the six regions
> that are not part of it. Summing only the real 332 gives 21,783 MW against a national 21,905 MW —
> 122 MW under, the residue being GSPs the file models and the API does not publish separately.
> Filtering the sum by `isLegacyRegion` is a one-line change and is Brad's call, not a cleanup.

For `data.reconciliation.test.ts`'s header (I updated it already, but note): the DNO double-count
is a **separate** problem that Brad's rule does not touch. Those 15 are ordinary GSPs appearing in
two licence areas in a grouping file — not duplicate spellings from the API. Still unanswered by
the API owner, still pinned, still must not be flipped to an equality assertion.

## 5. What landed

| File | What |
|---|---|
| `apps/nowcasting-app/scripts/build-geo-assets.mjs` | Committed, re-runnable, plain node ESM. No new dependency. |
| `public/geo/gb/{gsp,national,dno,zone,ng-constraints}.json` | Boundaries, minified |
| `public/geo/gb/{dno,zone}-groupings.json` | Re-keyed `Record<string, string[]>` |
| `public/geo/gb/groupings-manifest.json` | Loss report |
| `public/geo/nl/{province,national}.json` | 12 provinces + dissolve |
| `public/data/gb/national-metrics.json` | Seasonal norms |
| `config/countries.ts` | `geometry: GeoLayerConfig` on `DerivedRegionTypeConfig`, populated for GB dno/zone |
| `config/geo-aliases.ts` | New — `GEO_ALIASES` (empty for GB), `LEGACY_REGIONS`, `isLegacyRegion`, `geoAliasesFor` |
| `config/geo-aliases.test.ts` | New — 17 cases, both join directions + the capacity measurement |
| `components/helpers/data.reconciliation.test.ts` | Header comment only, no assertion change |

Run the build with `node apps/nowcasting-app/scripts/build-geo-assets.mjs`. I did **not** add a
`package.json` script (`build:geo`) — `package.json` is not in my ownership list; worth adding.

Sizes: output is minified where the sources were pretty-printed, so it is much smaller with no loss
of precision or features — `ng_zones.json` 17 MB -> `zone.json` 2.48 MB, GSP 10.5 MB -> 8.63 MB;
~13.9 MB shipped in total. `crs` members stripped (dropped from GeoJSON in RFC 7946; Mapbox and
turf both ignore them).

### Grouping re-key — matches the Phase 2 probe exactly

348/349 DNO refs and 306/317 zone refs resolved. Both figures reproduced without tuning.

- **DNO**: 1 unresolved ref — gsp_id **348** in `SSE (Southern)`.
- **NG zone**: 11 unresolved — gsp_ids **5, 17, 53, 75, 139, 140, 143, 157, 163, 225, 310**.
- **Regions in no DNO group**: 5 — exactly the composite regions, which is coherent: the grouping
  files predate the API's composites.
- **Regions in no NG zone group**: 32, mostly London and Home Counties (`hack_1`, `wham_1`,
  `isli_1`, `barkr_a`, `wimbn1`, …). Same story as the 11 unresolved ids seen from the other side:
  the zone file is a 2025 snapshot of a region set that has churned. **Reported, not fixed** —
  closing it needs a refreshed zone grouping, a data-sourcing job.

The DNO double-count (15 GSPs in two licence areas) is reproduced exactly, per the contract.

## 6. Assumptions — the part that needs Brad

1. **FRAGILITY: a build artefact now depends on test data.** The build script's only source for the
   `gsp_id -> v1 region name` translation is `lib/api/v1/__fixtures__/gb-regions-gsp.json`, a test
   fixture. It is the *only* artefact in the repo carrying both `metadata.gsp_id` and the v1 `name`
   — `data/gsp-regions.json` is 2022 boundary geometry and `data/grid-supply-points.json` is a
   spreadsheet export keyed on `"GSP ID"` (`ABNE_P`) with no gsp_id at all. So the shipped grouping
   assets, the legacy list and the join-rate test all derive from a file that lives under
   `__fixtures__` and could reasonably be edited by someone thinking they are adjusting test data.
   At minimum it wants a comment saying so; better, promote it to a captured-response file outside
   the test tree.
2. **GB `national.json` is named `"Great Britain"`.** The source has `properties.id = "National"`
   and no `name`, but the registry joins `national` on `name` untransformed. I wrote the name from
   the national fixture. NL's is `"netherlands"`, lowercase where GB's is title-case — that
   asymmetry is the API's, not mine. The test pins both, so a manifest change breaks loudly rather
   than drawing nothing.
3. **The NL dissolve uses `turf.union`, and is a real dissolve.** Internal province borders are
   clipped away, not merely bagged into a MultiPolygon. `@turf/turf@7.1.0` was already an app
   dependency (hoisted to the repo root by the workspace) — **no dependency added**. The result is
   a MultiPolygon; NL has offshore islands, so a single Polygon was never going to be right.
4. **`geometry` is required, not optional, on `DerivedRegionTypeConfig`.** A derived level with a
   grouping file and no polygons cannot render, so the type refuses to express one. Nothing else in
   the repo constructs one — grepped; only the declaration and `COUNTRY_CONFIG` — so no other
   track's fixture broke.
5. **DNO joins on `LongName`, zones on `id`, neither transformed.** Verified against the real
   feature properties: `LongName` is `"UKPN (East)"` and the grouping file keys groups
   `"UKPN (East)"` verbatim; likewise `"NE Scotland"`. The DNO `Name` field is the single-letter
   GSP-group code (`_A`) and joins nothing. Both pinned by tests.
6. **`GEO_ALIASES.GB` is empty and the mechanism was kept anyway.** An empty explicit table is a
   reviewable claim ("we checked, there are no naming disagreements") where a deleted file is not,
   and the next boundary refresh may well introduce one.

## 7. Other findings the contract did not predict

- **"7 unmatched features" and "3 unmatched keys" are both true.** The contract counts features;
  there are only three distinct unmatched *keys*, because `off_nets(unassigned)` is five features.
  The test pins the exact key set so a rebuild that orphans a real GSP cannot hide among them.
- **The Off_NETS negative-id workaround may be obsolete.** `data.ts` explains that the four Off_NETS
  features got distinct negative ids because v0 gave all four id 1000 and feature state cannot
  tolerate that. In the 2026 file they share one key and match no region, so under name-keyed
  joining they simply do not join. Whoever owns `data.ts` should check whether it still earns its
  place. (There are now five, not four.)
- **NG zone groupings are a clean partition; DNO groupings are not.** Confirmed on the shipped
  assets. So the zone level's 32-region gap is purely coverage, not double-counting — the two files
  fail differently and need different fixes.

## 8. For other tracks

- Assets are at the exact paths the registry already declared. Nothing new invented.
- Groupings are `Record<string, string[]>` of v1 region names. Stop going through `RegionBridge`.
- `isLegacyRegion(country, name)` in `config/geo-aliases.ts` is the filter for "do not draw, do not
  sum". Anything iterating the API's GSP regions — map painting, capacity totals, region pickers —
  should consult it, otherwise the six legacy regions reappear as blank polygons or inflated sums.
- `geoAliasesFor(country, key)` returns the feature key(s) for a region, defaulting to `[key]`. It
  expects the key already lowercased for GB. It can in principle return two features for one
  region, so `buildMapGeometry` should not assume 1:1 — though today, GB's table being empty, it
  never does.
- The old `data/*.json` files are untouched. This track was purely additive.
