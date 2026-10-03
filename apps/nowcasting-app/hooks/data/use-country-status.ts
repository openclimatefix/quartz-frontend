/**
 * Whether a country's data pipeline is healthy, for the status lamp on the header's country
 * toggle.
 *
 * ## This is a stub, on purpose, and it must stay one until the API changes
 *
 * There is no per-country status endpoint. `components/hooks/useStatus.ts` fetches
 * `/solar/GB/status` with GB hardcoded, and its doc comment says in as many words: do NOT
 * thread `scope.country` into that URL as a shortcut to supporting another country. Doing so
 * here would be the same mistake one layer up — every country would be handed GB's incident
 * as if it were their own, which is worse than showing nothing, because a green lamp that is
 * really GB's green lamp is a claim the UI cannot support.
 *
 * So this returns `ok` with no message for every country, and fetches nothing. Inventing a
 * plausible URL (`/solar/{country}/status`) was considered and refused: an endpoint nobody has
 * confirmed exists fails as a 404 that SWR retries, and the failure would be indistinguishable
 * from a country genuinely having no status.
 *
 * ## What changes when the endpoint lands
 *
 * Only this file. Replace the constant below with the fetch — presumably `useLoadDataFromApi`
 * against whatever the country-aware status URL turns out to be — and map its payload's
 * `status`/`message` onto `CountryStatus`. `useStatus.ts`'s two hooks should move onto the same
 * source at the same time so the banner and the lamp cannot disagree. Callers need no change:
 * they already ask per country and already render all three levels.
 *
 * The rendering in `components/layout/header/country-toggle.tsx` treats the non-ok levels as
 * real and reachable, and its tests drive them by mocking this hook, so the day the fetch
 * arrives there is no dormant UI to wake up.
 */

/**
 * `warning` is "degraded but the numbers are still worth reading"; `error` is "do not trust
 * what this country is showing". Deliberately three levels rather than a boolean: the map
 * draws a country either way, so the lamp has to distinguish "late" from "wrong".
 */
export type CountryStatusLevel = "ok" | "warning" | "error";

export type CountryStatus = {
  level: CountryStatusLevel;
  /** Human-readable, and null whenever `level` is "ok" — an ok country has nothing to say. */
  message: string | null;
};

const OK: CountryStatus = { level: "ok", message: null };

/**
 * Takes a country code it does not yet use. That is the same deliberate dead parameter
 * `useStatus.ts` keeps its `Scope` for: it is what makes the eventual swap a change to this
 * file rather than a hunt through call sites.
 */
export const useCountryStatus = (code: string): CountryStatus => OK;
