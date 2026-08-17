import { FC, ReactNode, useEffect, useState } from "react";

/**
 * Renders its children in the browser only, never on the server.
 *
 * ## Why this exists
 *
 * The app's country state is seeded from a cookie at module scope (`globalState.tsx`, via
 * `js-cookie`). `Cookies.get()` needs `document`, so on the server it reads nothing and
 * `enabledCountries` initialises to the default `["GB"]`. In the browser the same module runs
 * *before* hydration, sees the real cookie, and gets whatever the user actually turned on —
 * `["GB", "NL"]`. Server HTML and the first client render therefore disagree about a value
 * twenty-odd components read, and React fails hydration on the first one that puts it on screen:
 *
 *     Warning: Text content did not match. Server: "GB" Client: "GB NL"
 *
 * That was `CountryToggle`'s loading branch, which renders `enabledCountries.join(" ")` as text.
 * It was not the only site — `cursor-readout.tsx` renders a row per enabled country — only the
 * first, after which React abandons the server HTML and re-renders the root on the client
 * anyway. So the server's work was already being thrown away; it was just being thrown away
 * *with four red overlays first*.
 *
 * ## Why not fix it where it shows
 *
 * Because "where it shows" is not a fixed set. Any of the components reading
 * `useEnabledCountries` / `useFocusedCountry` is one render away from putting a cookie-derived
 * value into markup, and the failure mode is silent on a fresh browser: it needs a cookie
 * holding something other than the default, so it reproduces on a real user's machine and not
 * on a clean one. A per-component gate is a rule that has to be remembered forever; this is a
 * boundary that cannot be forgotten.
 *
 * The genuinely correct fix is to seed the state per request from `getServerSideProps` (both
 * pages already read cookies there for dashboard mode) and get real server-rendered markup —
 * which would also close a latent problem in the current design: module-scope global state is
 * shared across requests on the server, and is only safe today because it is always the
 * defaults. That is a much larger change, and it buys first-paint HTML for an authenticated
 * Mapbox-and-SWR dashboard that has no SEO to protect and repaints from client state
 * immediately. Not worth it (Brad, 2026-08-17); revisit if this page ever needs to be indexed
 * or to paint meaningfully before JS.
 *
 * ## The mechanics
 *
 * `mounted` is false on the server *and* on the first client render, so both produce the
 * fallback and hydration matches by construction. The effect then flips it and the real tree
 * mounts. This is deliberately not `dynamic(..., { ssr: false })`: same outcome, but a boundary
 * you can see and grep for beats an import option, and the page's own hooks are harmless to run
 * server-side — they compute, they do not render.
 */
const ClientOnly: FC<{ children: ReactNode; fallback?: ReactNode }> = ({
  children,
  fallback = null
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children : fallback}</>;
};

export default ClientOnly;
