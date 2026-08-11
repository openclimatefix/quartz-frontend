# Phase 6, Track C — Sites to its own route

Wave 2, run alongside Track D. Implements `phase6-layout-contract.md` §2: Solar Sites is not a
country view, so it moves off the dashboard onto `pages/sites.tsx`. **Move, not redesign** (Brad)
— sites gets proper chrome when the sites v1 migration lands, not here.

## What changed in behaviour

**`useSitesViewData` no longer runs on the dashboard.** `pages/index.tsx` still imports and calls
it — untouched, per the brief, since Track D owns that file and deletes the wiring as part of
building the new shell. What this track delivers is that the hook now has a second, real caller
(`pages/sites.tsx`) that is the only place it needs to run. Once D removes the dashboard's call,
opening the Forecast view stops fetching the sites list, a site forecast and site actuals it never
showed — the whole point of the move.

**The `nl_` site filter is gone.** `useSitesViewData.ts` used to `.splice` NL-prefixed sites out of
the sliced list while iterating over it — a bug that skipped the element after every removal, so
two adjacent NL sites left one behind; it never actually worked. It existed only because sites was
a tab on the country dashboard and NL has no sites. On a tenancy-scoped route with no country
concept, there is nothing to filter — the gate is "does this user own the site", answered entirely
by what `/sites` returns for the logged-in tenant. Deleting it also removes the last country
branch in this file.

**The `Scope` plumbing stays**, per the brief: `useFocusedCountry()` still feeds `scope.country`
into `useLoadDataFromApi`'s three calls. `SITES_API_PREFIX` is v0 and GB-only, so it ignores the
scope today, but the plumbing is Phase 4's contract and this track has no reason to touch it.

## `pages/sites.tsx`

Same auth gate as `pages/index.tsx`, copied verbatim — `withPageAuthRequired`, the
`NEXT_PUBLIC_DEV_MODE` branch, the `dashboardMode` cookie read into `dashboardModeServer`.

The layout is map-right/chart-left, reproduced inline rather than through
`components/layout/*` or `components/side-layout/*`. Both are Track D's Wave 2 territory — D is
rewriting `layout.tsx` and `side-layout/*` concurrently for the full-bleed shell — so importing
either would couple this route to a shape mid-rewrite, and the `SCOPE NOTES` in this track's brief
say to duplicate or inline instead. What sites actually used from `SideLayout` was the width
toggle and the expand handle; the info-tooltip half was already conditionally hidden for
`VIEWS.SOLAR_SITES`, so it needed nothing. That's what's inlined in `sites.tsx` — no `ExpandButton`
import, just the same two `react-icons` glyphs and a local `isChartOpen` state.

**There is deliberately no header, no `StatusBanner`, no `DeprecatedDomainNotice` on this page.**
All three live in `components/layout/`, which is Track D's file. Rendering `Header` would need
`view`/`setView: VIEWS`, wiring this route back into the exact nav model the contract says sites
should not have (§2: sites has no country semantics, no comparison control, none of the things
that nav carries) and that D is actively reshaping. The brief also says explicitly not to add a
nav link. So for now `/sites` is reachable only by URL — **this is the one thing to flag to Brad
for the live pass**: there is nothing in the UI yet that takes a user there.

## For Track D

- `pages/index.tsx`'s `useSitesViewData` call, the `SitesMap`/`SolarSiteChart` mounts and their
  `hidden`-class toggling are all exactly as you left them — this track did not touch
  `pages/index.tsx`, per the brief.
- Once your new shell lands, `/sites` needs a way in. Contract §2 doesn't specify where — a nav
  item, an account-menu entry, whatever the new header ends up carrying. This track intentionally
  left that decision to you rather than adding a link ahead of the shell that would own it.
- `useMapChrome`'s three effects exist to compensate for hidden-but-mounted maps. `pages/sites.tsx`
  mounts exactly one map and never hides it, so it doesn't call `useMapChrome` at all — nothing for
  you to account for there when you trim that hook's effects in Wave 4.
- Sites' zoom bands (`AGGREGATION_LEVELS`, `constant.ts`) are untouched, per OPEN item 10 in the
  contract — not this track's call to make.

## What needs live verification (Brad)

- `/sites` loads directly (typed in the address bar) and behaves exactly as the Solar Sites tab
  did on the dashboard: same map, same chart, same expand handle, same "Welcome to Site View" empty
  state for a tenant with no sites.
- The dev-mode and production auth gates both still redirect an unauthenticated visit the same way
  `/`'s does.
- Confirm there's no visible regression from the missing header/status-banner/deprecated-domain
  notice — expected today, but worth Brad's eyes before D wires up navigation to it.
- Network tab check: opening `/` (Forecast view) no longer issues the three sites calls
  (`/sites`, `/sites/pv_forecast`, `/sites/pv_actual`) — though this is only fully true once Track D
  removes `useSitesViewData` from `pages/index.tsx`; until then it's a no-op confirmation that the
  hook itself still behaves identically wherever it's called from.

## Verification

`yarn tsc --noEmit` — clean, only the known pre-existing `jest.globalSetup.ts(14,1) TS1208` error,
untouched by this track. `npx next lint` — 0 errors, the same pre-existing warning set as before
(none new, none in files this track touched). Full Jest suite — **1012 passed / 39 suites**, no
change in count (no new tests added: `useSitesViewData` and `sitesMap.tsx` had no existing test
coverage to extend, and the deleted `nl_` filter had none either — the splice bug was undetected by
tests before this change and remains undetected now, just gone instead of latent).
