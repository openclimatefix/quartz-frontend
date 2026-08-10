# Phase 6, Track A — the country split

Wave 1, the first of the two seams. `useCurrentCountry()` answered two questions with one
value; it now answers them separately, per `phase6-layout-contract.md` §1.

## What the seam is

```
enabledCountries: string[]   which countries draw on the map     useEnabledCountries()
focusedCountry:   string     which country owns the chart        useFocusedCountry()
```

Two invariants, enforced in the writers rather than checked at the call sites, because
everything downstream (the map fan-out, Track B's cursor grid, the chart's single country)
assumes both without testing them:

1. **`enabledCountries` is never empty.** An empty set is a blank map with no way back.
2. **`focusedCountry` is always a member of it.** You cannot read a chart for a country you
   are not drawing.

`components/helpers/globalState.tsx` owns both. Nothing else may write either key.

| Writer | Does |
| --- | --- |
| `setFocusedCountry(code)` | Moves focus; enables the country if it was not; clears the **outgoing** country's region selection; persists the `country` cookie. |
| `setEnabledCountries(codes)` | Replaces the set; drops unconfigured codes; refuses to empty it; moves focus if the focused country left; clears the selection of everything dropped; persists the `enabledCountries` cookie. |
| `toggleCountryEnabled(code)` | One country on or off. Does **not** move focus when enabling. |
| `focusAndSelectRegions(country, ids)` | The map click path: focuses the region's country, then selects there. One function because the order is a trap — see below. |

## What changed in behaviour

**A country's region selection no longer survives it losing focus.** This is the one
deliberate reversal of the Phase 4 rule that "nothing is reset on switch". Contract §1 and
§7: a selection cannot outlive the country it belongs to, which is what makes "multi-region
selection is same-country only" structurally impossible to violate rather than a rule
something has to police.

The viewport (`lng`/`lat`/`zoom`) and the aggregation level are **not** cleared — switching
away and back still restores where you were looking, which is why these keys are
country-keyed in the first place. The exact list is `SELECTION_SCOPED_KEYS` in
`countryState.ts`.

**The header control is a multi-select**, carrying `aria-pressed` for enabled and nothing
about focus. Focus has its own control — see below.

## Two controls, not one

Brad's call, and the right one: putting enable *and* focus on the same header buttons made
one gesture quietly do two things, when focus mostly affects the chart. So they split by
what they change, and each sits next to the thing it changes. This is contract §7's "a
country switcher may sit in the chart header as well as in the top nav, if that reads
better in practice" — it does.

| Control | Question | Behaviour |
| --- | --- | --- |
| Header — `layout/header/country-toggle.tsx` | which countries are **drawn** | Independent toggles over the whole manifest. Unentitled countries shown but disabled. The last enabled one is disabled — an empty set is a blank map with no way back. |
| Chart header — `charts/country-picker.tsx` | which country the chart **reads** | Single-select over the *enabled* set only. Sits with the "National" title, because it qualifies it: these are GB's national numbers, not the app's. |

Two consequences worth knowing:

- **Enabling no longer focuses.** Turn NL on and the map gains NL while the chart stays on
  GB, which is exactly what "enable" should mean. The picker gaining an NL option is the
  affordance that says where to go next.
- **The picker only offers what is drawn.** Choosing a country that is not on the map would
  have to enable it, which is the muddle being removed. Add it in the header first.

The one place the header still touches focus is disabling the focused country, and that is
the invariant rather than a choice — the chart cannot read a country that is not drawn.

## Selection sets focus — the map click path

Contract §1's third rule, and the one that makes "multi-region selection is same-country
only" structurally impossible to violate rather than something to police: a selection is
always made *through* focus.

> Note for anyone reading the contract's OPEN list: item 3 asked this question and was
> already answered by §1 — it survived the edit that closed it. It has now been struck
> through. I deferred this work on the strength of the stale entry before Brad caught it.

`focusAndSelectRegions(country, regionIds)` in `globalState.tsx` is the whole path, and it
is one function rather than two calls at the call site because the ordering is a trap:

```ts
setSelectedMapRegionIds(ids);   // ← wiped a moment later
setFocusedCountry(country);     // clears the outgoing country's selection
```

That spelling drops the click on the cross-country case *only*, which reads as a missed
event rather than an ordering bug. Focus first, then select. Pinned by four tests in
`countryState.test.ts`.

`use-update-map-state-on-click.ts` now routes through it. A click on another country's
region focuses that country and starts its selection fresh — including under shift, because
a selection spanning two countries is what §1 makes unreachable.

**What is not live yet, and why.** The map still draws one country at a time
(`useMapGeometry` is scoped to the focused country), so there is no other country's region
on screen to click. The handler reads the country off the clicked feature's
`REGION_COUNTRY_PROPERTY` and falls back to the focused country, which is always taken
today. **Track D stamps that property when it fans the map out over
`useEnabledCountryListings()`, and cross-country focus works with no further change to the
click path.**

The remaining piece is presentation: §1 wants the chart's country chip to visibly *move*
from the old country to the new, so the chart changing under the user is signalled rather
than silent. The picker is the element to animate; the animation is Track D's, alongside
the chart shell it lives in.

## Entitlement

Deliberately **not** applied in the state layer. The Auth0 claim arrives asynchronously and
does not exist on the tenant yet (`lib/api/auth/entitlement.ts`), so filtering the enabled
set at global-state initialisation would empty it for every user in production today.

It is applied where it can wait for the claim:

- the toggle, which will not enable a country the user has no access to, and
- `useEnabledCountryListings()`, which intersects enabled ∩ entitled ∩ configured before
  anything fans out over it.

`useEnabledCountries()` returns codes and no loading state on purpose — a map layer or a
cursor grid can depend on it synchronously. Use the listings hook when you need the name,
the config or the entitlement alongside.

## Cookies

`country` (unchanged, the focused one) and a new `enabledCountries`. Both are validated on
read against the static registry, the same shape of check `getValidatedPLevels` has always
done. The interesting case is the two disagreeing: a focused country missing from the stored
set is **added** rather than dropped, because dropping it would boot the chart to a country
the user did not choose. Pinned in `countryState.test.ts`.

## Surface for the later tracks

```ts
import {
  useEnabledCountries,        // string[]  — synchronous, never empty
  useEnabledCountryListings,  // manifest listings, entitlement-filtered
  useFocusedCountry           // string
} from "hooks/data";

import {
  focusAndSelectRegions,
  setEnabledCountries,
  setFocusedCountry,
  toggleCountryEnabled
} from "components/helpers/globalState";
```

`useCurrentCountry` is gone rather than kept as an alias — Wave 1 is the moment to do that,
while nothing else is in flight, and leaving it would have let later tracks code against the
ambiguity this phase exists to remove.

**Track B** takes `useEnabledCountries()` as the input to the finest-cadence grid.

**Track D** takes `useEnabledCountryListings()` as what the map fans out over, and owes two
things to finish §1: stamp `REGION_COUNTRY_PROPERTY` onto each feature so the click path can
tell whose region was clicked, and animate the chart's country chip when focus moves.

## Verification

`yarn tsc --noEmit` clean, `next lint` 0 errors (17 pre-existing warnings, none in the
touched files), `next build` green, full Jest suite **982 passed / 38 suites**.

Live verification against prod is Brad's, per the usual split. Worth eyeballing:

- toggling NL on in the header — both countries draw, the chart stays on GB, and the chart
  header's picker gains an NL option;
- picking NL in the chart header — the numbers change country, the map is untouched;
- toggling NL off while it is focused — focus falls back to GB rather than blanking;
- toggling GB off with only GB enabled — refused, and the button says so;
- a region selected in GB, then focus moved to NL and back — the selection is gone, the
  viewport and level are where you left them;
- ordinary GB region clicks and shift multi-select — unchanged, since the click path's
  cross-country branch cannot fire until the map draws more than one country.

The picker sits left of "National" in the chart header, and only appears as buttons when
more than one country is enabled — with one it is a plain label, so the GB-only view is
unchanged apart from a small country chip.
