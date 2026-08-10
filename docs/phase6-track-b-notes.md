# Phase 6, Track B — the time seam

Wave 1, the second of the two seams, sequenced after Track A because it needs the enabled set.
Implements `phase6-layout-contract.md` §4: the cursor becomes shared chrome that knows more than
one cadence exists.

## What the seam is

Two values that used to be one, and confusing them is the whole failure mode:

```
the cursor      one UTC instant, on the finest ENABLED country's grid      getCursorNow()
a country slot  the slot THAT country published, containing the cursor     slotForInstant(t, c)
```

`get30MinNow` did both jobs at GB's cadence hardcoded, which was correct only because every
country was GB. With NL enabled the cursor grid is 15 minutes, and a GB lookup at NL's 16:15
finds nothing in any region — a blank country rather than an error. So **every boundary where
the shared cursor meets one country's data resolves it first.**

`lib/time/cursor.ts` holds all the arithmetic and imports nothing but Luxon and the registry.
`globalState.tsx` joins it to state in two lines (`getCursorCadenceMinutes`, `getCursorNow`).

## The resolution rule, and why it is written down

**Timestamps label the END of their period, so resolution is a ceiling — never "nearest".**

```
cursor ------> 16:15 UTC
  GB  30-min   16:30 slot  (covers 16:00-16:30)
  NL  15-min   16:15 slot  (covers 16:00-16:15)
```

Nearest is what anyone reaches for by default and it is wrong by up to half a period, in a way
that still looks entirely plausible on screen. The invariant existed only in user-facing copy
(`ChartInfo.tsx`'s legend tooltip); it now sits in the module that depends on it, with the worked
example above pinned as a test.

It had never bitten because the slider stepped through `times_utc` exactly, so no rounding ever
happened. A cursor shared across two cadences is what makes it live.

**The grid is anchored in UTC**, via epoch-millisecond arithmetic. Every cadence divides 60, so a
country whose offset is a whole or half hour sees the same grid on its own wall clock — and the
grid does not move across DST. A local-time anchor would shift every slot by an hour twice a
year, on different dates in different countries. Pinned by counting slots across both 2026
transition days: 48 at 30 minutes, 96 at 15, on the days a local grid would give 47 or 49.

## Two new registry fields

| Field | GB | NL |
| --- | --- | --- |
| `cadenceMinutes` | 30 | 15 |
| `slotLabelling` | `period-end` | `period-end` — **UNCONFIRMED** |

`cadenceMinutes` is measured, from the period fixtures. `slotLabelling` answers the contract's
OPEN 4a, and it answers it with the no-change assumption rather than a finding: **nobody has
confirmed that NED publishes period-end.** If it publishes period-start, every NL lookup is one
15-minute slot out — plausible on screen, wrong. That is why it is a field and not a constant:
confirming it either way is a one-word edit in `config/countries.ts`, and `slotForInstant` already
floors instead of ceilings when it says `period-start` (pinned by a test).

A test also asserts every configured cadence divides 60, since the UTC-hour anchor depends on it.

## Surface

```ts
import {
  cadenceMinutesFor,    // one country's step
  finestCadenceMinutes, // the cursor grid, from the enabled set
  cursorNow,            // now, on a given grid — strictly the next slot
  nextSlot,             // the slot strictly after an instant
  snapToCadence,        // put a cursor INPUT on the grid (ceiling, non-strict)
  slotForInstant,       // the cursor resolved to ONE country's published slot
  isOnCadence
} from "lib/time/cursor";

import { getCursorNow, getCursorCadenceMinutes } from "components/helpers/globalState";
```

**`nextSlot` is strict and `snapToCadence` is not**, and the difference is deliberate: at exactly
16:00:00.000 the 16:00 slot has just closed, so "now" is 16:30 (which is what `get30MinNow`
always did); but a cursor *at* 16:15 on a 15-minute grid is the 16:15 slot, not the next one.

`get30MinNow`, `get30MinSlot` and `getNext30MinSlot` are gone rather than kept as aliases — same
reasoning as Track A deleting `useCurrentCountry`. Leaving them would let later tracks code
against the single-cadence assumption this track exists to remove.

## What changed in behaviour

Everything below is a **no-op on a GB-only session**, which is every session today until a user
enables NL. The values are identical to what they always were.

- **The cursor re-snaps when the enabled set changes** (`writeEnabledCountries`). Disabling NL
  coarsens the grid *under* a cursor already on it; enabling only refines, so that direction is a
  no-op. `timeNow` is re-derived rather than snapped, since it means "now".
- **The play button, the arrow keys and the satellite prefetch step one slot**, not a hardcoded
  30 minutes. On a 15-minute grid the old stride skipped every other published value, and
  prefetched every other neighbouring frame.
- **Click-to-set-time snaps** to the cursor grid. Usually a no-op — the label comes off a real
  axis point — but it keeps the chart and the map from ever being a slot apart.
- **The map, the GSP chart, the delta hook and the national chart's past/future split resolve the
  focused country's slot** rather than reading the raw cursor. The chart one is the subtle case:
  its comparisons are ordinal, so a finer cursor does not error — the boundary row simply falls
  on the past side and `FUTURE` starts one slot late, which draws as a gap at "now". That is the
  same symptom as the NL gap fixed in `36e8276`, from a different cause.
- **`ForecastHeader`'s "next forecast" is one step on the focused country's grid.** Visible in
  `country-wiring.test.tsx`, whose NL expectation moved from 12:30 to 12:15 — the one intentional
  test change in this track.

Two incidental corrections, both previously working only by cancellation:

- `remix-line`'s "now" reference line read `getMinutes()` off a local-zone `Date`; it is now UTC
  throughout. Correct in every viewer zone rather than in whole-hour ones.
- The delta chart's slot lookup went through `convertToLocaleDateString` + a mutating `Date`
  round trip that cancelled itself out. It is `slotForInstant` now, said once.

## For Track D

The map's fan-out gives each enabled country its own `useMapRegionValues`, and each resolves the
shared cursor to its own slot with no further change — the resolution is already inside the hook
rather than at its call site.

Contract §4 wants the cursor's readout to name the grain and show the other enabled countries'
local times alongside ("GB 16:00 · NL 17:00"). The arithmetic for that is `slotForInstant` per
country plus `useCountryFormatting`'s zone; the chrome to put it in is Track D's.

## Verification

`yarn tsc --noEmit`, `next lint` 0 errors (17 pre-existing warnings, none new), `next build`
green, full Jest suite **1012 passed / 39 suites** — 30 of them new (26 in `lib/time/cursor.test.ts`,
4 in `countryState.test.ts`).

One **pre-existing** `tsc` error survives and is untouched: `jest.globalSetup.ts(14,1) TS1208`,
a CJS `module.exports` file under `--isolatedModules`. Making it a module would change how the
file that pins the test process to UTC is loaded, which is not a thing to do in passing on a
timezone track.

Live verification is Brad's, per the usual split. Worth eyeballing — all of it needs NL enabled
in the header, since GB-only is byte-identical to before:

- scrub the chart with NL enabled and GB focused: the map keeps painting (it would go blank at
  every :15 and :45 without the resolution), and the "now" line stays put on the chart;
- focus NL: the cursor lands on 15-minute values and the header's "next forecast" is +15;
- disable NL while parked on a :15 value: the cursor jumps forward to the next :00/:30 rather
  than leaving the map empty;
- hold an arrow key with NL on, then off: the step visibly halves and doubles;
- the play button with NL enabled: it should visit every published value, not every other one.
