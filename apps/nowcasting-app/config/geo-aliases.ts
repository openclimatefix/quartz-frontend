// Which GSPs exist, and what to do where the API and the boundary file disagree about a name.
//
// THE RULE, from Brad (2026-08): the NESO boundary file is definitive. For GB that is
// `GSP_regions_4326_20260209.json` — 362 features — and it defines which GSPs we care about,
// full stop. The v1 API's region list is NOT the target to match. The API serves "all"
// regions, including merged and legacy spellings of the same physical GSP, purely so that
// existing client scripts keep working. A region the NESO file does not model is legacy: it
// is not a region we are failing to draw.
//
// That rule does two things here. It empties the alias table (see below), and it produces
// `LEGACY_REGIONS` — the API regions we deliberately do not draw, named explicitly so that the
// decision is reviewable and so that a future API change shows up as a test failure rather
// than as a polygon quietly going blank.

/** v1 region name -> the GeoJSON feature key(s) that draw it, where the API and the boundary
 *  file spell the SAME real region differently. See the contract for why this cannot be
 *  fixed by refreshing the file.
 *
 *  Not for reconciling splits and merges. Where the API serves both a merged region and its
 *  constituent parts, exactly one side is real — the side the NESO file models — and the
 *  other belongs in `LEGACY_REGIONS`. Aliasing there would draw the same ground twice and
 *  inflate the national total, which is precisely the 683 MW bug this rule resolves.
 *
 *  **GB is currently empty, and that is a finding, not an oversight.** Under the earlier
 *  "match all 338 API regions" reading this table had six entries; re-derived under the NESO
 *  rule, all six turned out to be split/merge duplicates rather than naming disagreements, so
 *  every one of them moved to `LEGACY_REGIONS`. No genuine spelling disagreement survives:
 *  the case fold from `properties.GSPs` to the v1 name is the whole transformation. The
 *  mechanism stays because the next boundary refresh may well introduce one, and because an
 *  empty explicit table is a reviewable claim where a missing file is not.
 */
export const GEO_ALIASES: Record<string, Record<string, string[]>> = {
  GB: {}
};

/**
 * API regions with no feature in the definitive boundary file — served for backward
 * compatibility, deliberately not drawn, and deliberately excluded from any total.
 *
 * Every GB entry is the API publishing both sides of a split or merge. In each pair the NESO
 * file models one side; that side is real and draws normally, and the other is listed here:
 *
 *   legacy region                          real, per the boundary file        gsp_id
 *   ─────────────────────────────────────  ─────────────────────────────────  ──────
 *   carr_1                                 carr_1|fidf_1  (file merges)       56
 *   fidf_1                                 carr_1|fidf_1  (file merges)       122
 *   brle_1|flee_1                          brle_1 + flee_1  (file splits)     41
 *   iver_1|iver_6                          iver_1 + iver_6  (file splits)     158
 *   seab1|safo_1                           safo_1  (file splits; see note)    257
 *   actl_2|cbnk_h|gree_h|peri_h|wesa_h     the powe_h six-way spelling        4
 *
 * Note on `seab1|safo_1`: the file splits Seabank from South Fields, the API serves the merged
 * pair AND `safo_1` on its own. The merged region is therefore legacy and `safo_1` is real —
 * with the consequence that the file's `seab1` feature has no API region of its own and stays
 * undrawn. That is the honest outcome of the rule: the API does not publish Seabank
 * separately, so there is no value to paint on it. Do not "fix" this by aliasing the merged
 * region onto `seab1`; that would paint Seabank + South Fields' combined figure onto Seabank
 * alone while `safo_1` also draws its own.
 *
 * Note on Willesden: gsp_ids 4 and 350 share a name ("Willesden (Zone 1)") and a capacity
 * (5,299 kW) and differ only by `powe_h`. The file carries the six-way spelling, so 350 is
 * real and 4 is legacy.
 */
export const LEGACY_REGIONS: Record<string, string[]> = {
  GB: [
    "actl_2|cbnk_h|gree_h|peri_h|wesa_h",
    "brle_1|flee_1",
    "carr_1",
    "fidf_1",
    "iver_1|iver_6",
    "seab1|safo_1"
  ]
};

/** Whether a region is served only for backward compatibility and must not be drawn or summed. */
export const isLegacyRegion = (
  countryCode: string | null | undefined,
  regionName: string
): boolean =>
  (typeof countryCode === "string"
    ? LEGACY_REGIONS[countryCode.toUpperCase()]
    : undefined
  )?.includes(regionName) ?? false;

/**
 * The feature key(s) drawing a region, defaulting to the region name itself.
 *
 * Country code is uppercase as the manifest spells it. Callers apply the layer's
 * `joinTransform` to the region name before matching; alias keys and values are stored
 * already in the transformed (lowercase, for GB) form the file uses.
 */
export const geoAliasesFor = (
  countryCode: string | null | undefined,
  regionKey: string
): string[] =>
  (typeof countryCode === "string" ? GEO_ALIASES[countryCode.toUpperCase()] : undefined)?.[
    regionKey
  ] ?? [regionKey];
