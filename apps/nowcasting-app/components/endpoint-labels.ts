/**
 * The staleness indicator's row labels.
 *
 * These live in a real `.ts` module rather than in `components/types.d.ts` because they are
 * **values**, not types: a `.d.ts` file is erased at compile time, so an `export enum` declared
 * in one is `undefined` at runtime under ts-jest. That is why several test suites used to carry
 * a `jest.mock("../types.d", …)` workaround, and why `hooks/data/use-loading-state.ts` kept a
 * duplicated copy of the label list. Both are gone now.
 */
export enum NationalEndpointLabel {
  nationalForecast = "National Forecast",
  pvRealDayIn = "PV Live Estimate",
  pvRealDayAfter = "PV Live Updated",
  nationalNHour = "N-hour forecast",
  allGspForecast = "All GSP Forecast",
  allGspReal = "All GSP PV Live"
}
export type NationalEndpointKeysType = keyof typeof NationalEndpointLabel;

export enum SitesEndpointLabel {
  allSites = "All Sites",
  sitePvForecast = "Site PV Forecast",
  sitePvActual = "Site PV Actual"
}
export type SitesEndpointKeysType = keyof typeof SitesEndpointLabel;
