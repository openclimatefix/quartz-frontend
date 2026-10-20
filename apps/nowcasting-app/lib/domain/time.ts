import { DateTime } from "luxon";

import { UtcInstant } from "./types";

// Canonicalising the instant at the API boundary is what fixes the chart merge key.
//
// The chart merges series into rows keyed by a raw datetime *string*, so
// `2024-01-01T10:00:00Z` and `2024-01-01T10:00:00+00:00` produce two half-populated rows
// for the same moment. That is latent today only because every v0 producer happens to
// emit `+00:00` — and the v1 client is exactly what would start emitting `Z`. Rather
// than teach the chart to parse, every instant entering the domain model is normalised
// to one spelling here.

/** The one spelling the domain model uses: `YYYY-MM-DDTHH:mm:ssZ`. */
const CANONICAL_FORMAT = "yyyy-MM-dd'T'HH:mm:ss'Z'";

/**
 * Canonicalise any ISO-8601 instant to UTC `YYYY-MM-DDTHH:mm:ssZ`.
 *
 * Accepts offsets (`+01:00`), `Z`, and zone-less strings — which the API documents as
 * UTC, so they are read as UTC rather than as the viewer's local time. Sub-second
 * precision is dropped: nothing in this app is sampled finer than 5 minutes, and keeping
 * it would reintroduce the same two-spellings-one-instant problem.
 *
 * @throws if the input is not a parseable instant. A malformed timestamp is a wire
 *   contract violation, and silently mapping it to `null` would surface as a mystery gap
 *   in a chart rather than as an error anyone can act on.
 */
export const toUtcInstant = (value: string | Date): UtcInstant => {
  const dt =
    value instanceof Date
      ? DateTime.fromJSDate(value, { zone: "utc" })
      : DateTime.fromISO(value, { zone: "utc", setZone: false });

  if (!dt.isValid) {
    throw new Error(
      `Invalid instant: ${JSON.stringify(value)}${dt.invalidReason ? ` (${dt.invalidReason})` : ""}`
    );
  }

  return dt.toUTC().toFormat(CANONICAL_FORMAT);
};

/** As `toUtcInstant`, but passes `null`/`undefined` through — for nullable wire fields. */
export const toUtcInstantOrNull = (value: string | Date | null | undefined): UtcInstant | null =>
  value === null || value === undefined ? null : toUtcInstant(value);
