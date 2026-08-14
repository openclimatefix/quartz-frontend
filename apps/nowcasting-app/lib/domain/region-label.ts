/**
 * How a region's name is written when the API has no human label for it.
 *
 * `normaliseRegion` fills `Region.label` from `metadata.full_name` and falls back to the raw
 * `name` when there is none. That fallback is right for GB, whose GSP names are codes
 * (`citr_1`) that no amount of casing turns into English, and wrong for NL, whose province
 * names *are* the English — served lowercased (`noord-brabant`) because that is the key the
 * boundary join uses, not because anyone wants to read it that way.
 *
 * The client cannot tell those apart by looking: both are lowercase strings with a separator.
 * So the registry says which it is, per region type — `GeoLayerConfig.regionNameStyle` — and
 * this module is the whole of what the flag means.
 *
 * **Deliberately not applied to group names.** GB's DNO groups are keyed "UKPN (East)" and its
 * NG zones "NE Scotland": already-written labels with real capitalisation that a title-case
 * pass would destroy ("Ukpn (East)"). Groups are named by their grouping file, not by a
 * region's `name`, so they never reach this function.
 */

/** How a region type's raw names should be written for display. */
export type RegionNameStyle = "raw" | "titleCase";

/**
 * Word boundaries for title casing: whitespace and hyphens, both preserved.
 *
 * Hyphens matter and are the reason this is not a naive `split(" ")` — half of NL's provinces
 * are hyphenated compounds ("noord-brabant", "zuid-holland"), and capitalising only the first
 * word gives "Noord-brabant", which reads as a typo rather than a name.
 */
const WORD_BOUNDARY = /(\s+|-)/;

/**
 * Title-case a raw region name.
 *
 * Only the *first letter* of each word is touched; the rest of the word is left exactly as it
 * came. Lowercasing the remainder would be the usual spelling of "title case" and is wrong
 * here — it would rewrite a name that already carries deliberate internal capitals, and this
 * function cannot know whether a given name is one of those.
 */
const titleCase = (label: string): string =>
  label
    .split(WORD_BOUNDARY)
    .map((part) => (part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("");

/**
 * A region's label as it should be shown, given its region type's configured style.
 *
 * `raw` (the default, and every region type that does not opt in) returns the label untouched,
 * so a country whose API supplies real `full_name`s is unaffected by this existing at all.
 */
export const formatRegionLabel = (
  label: string | undefined | null,
  style: RegionNameStyle = "raw"
): string => {
  if (!label) return "";
  return style === "titleCase" ? titleCase(label) : label;
};
