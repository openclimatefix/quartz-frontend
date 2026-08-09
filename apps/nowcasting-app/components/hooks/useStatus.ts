import { API_PREFIX, SITES_API_PREFIX } from "../../constant";
import type { Scope } from "../../lib/domain/types";
import { SolarStatus } from "../types";
import { useLoadDataFromApi } from "./useLoadDataFromApi";

/**
 * The status banner's two backends, isolated behind one module per the Phase 5 contract
 * ("the status API base URL and response shape are still open items — isolate, do not
 * invent"). Both stay on their current v0 endpoints this phase; nothing here guesses at
 * what a v1 status endpoint would look like.
 *
 * Each hook takes a `Scope` — country, source, region type — even though neither URL uses
 * it today. That is deliberate, not dead weight: it is what makes the eventual swap to a
 * country-aware status endpoint a change to this file alone, rather than a hunt through
 * every call site for a hardcoded "GB". Do NOT thread `scope.country` into either URL below
 * as a shortcut to "supporting" NL — see the open questions.
 *
 * OPEN QUESTIONS (deliberately not resolved here — flag to Brad, do not guess):
 *  - `solar/GB/status` is hardcoded to GB regardless of `scope.country`. No other country
 *    has ever been asked for a status. Whether a country-aware endpoint exists, and what
 *    it's called, is unknown.
 *  - `${SITES_API_PREFIX}/api_status` carries no scope at all — no country, no source. The
 *    sites view is GB-only today, but nothing in the URL enforces that or would surface a
 *    mismatch if it stopped being true.
 *  - `SolarStatus` (`{ status, message }`) is asserted from historical usage, not a schema.
 *    If the real payload carries more fields, they are silently dropped by the type, not
 *    rejected at runtime — there is no validation layer here to catch a shape change.
 */

/** The main (non-sites) view's status, from `/solar/GB/status`. Ignores `scope.country`. */
export const useSolarStatus = (scope: Scope) =>
  useLoadDataFromApi<SolarStatus>(`${API_PREFIX}/solar/GB/status`, { scope });

/** The Solar Sites view's status, from `${SITES_API_PREFIX}/api_status`. Scope-less API. */
export const useSitesStatus = (scope: Scope) =>
  useLoadDataFromApi<SolarStatus>(`${SITES_API_PREFIX}/api_status`, { scope });
