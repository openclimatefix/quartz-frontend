import { Settings } from "luxon";

/**
 * The locale every date and time in the app is displayed in.
 *
 * **Hardcoded to GB on purpose, for now.** Luxon (like `Intl`) otherwise formats in the
 * *viewer's* browser locale, so the same forecast read `13/08/2026` in London and `8/13/2026`
 * in New York — and `1:30 PM` rather than `13:30`, which is not how anyone in this domain
 * writes a settlement period. The data is British and Dutch grid data; the presentation should
 * not drift with whoever happens to be looking at it.
 *
 * A per-user preference is expected later. When it lands, this constant is the seam: change
 * what is passed to `applyDisplayLocale`, and every formatter follows, because none of them
 * name a locale themselves.
 */
export const DISPLAY_LOCALE = "en-GB";

/**
 * Set Luxon's process-wide default locale.
 *
 * A global default rather than a `locale` argument at each call site, deliberately. Two
 * reasons: `toFormat` tokens are locale-sensitive too — `ccc` and `LLL` render weekday and
 * month *names* — so the alternative is remembering a locale in two different APIs at every
 * call; and a call site added later inherits the right answer instead of silently reverting to
 * the browser's. The cost is one piece of global state, set once, in one place.
 *
 * Called from `_app.tsx` for the browser and from `helpers/utils.ts` at import so that server
 * rendering and any non-React consumer (CSV export, tests) get it without depending on the
 * React tree having mounted.
 */
export const applyDisplayLocale = (locale: string = DISPLAY_LOCALE): void => {
  Settings.defaultLocale = locale;
};

applyDisplayLocale();
