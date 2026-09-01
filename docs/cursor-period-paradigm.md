# The cursor is a period, not an instant

Written 2026-09-01, on `spike/ocf-reskin`. Everything below is committed
(`ffd9eecd`, `7e7f0a8c`); 1289 tests pass, typecheck clean, nothing pushed.

## The bug this started from

Two countries, two labelling conventions: GB timestamps name the **end** of a settlement
period, NL the **start**. The shared cursor is one instant, and it always sits exactly on a
period boundary — so "the period containing the cursor" was ambiguous, and each country
resolved the ambiguity in the direction its own labelling pointed. GB ceilinged and took the
period *ending* at the cursor; NL floored and took the one *starting* there.

At cursor 12:00 UTC the footer showed `GB 12:30–13:00` and `NL 14:00–14:15` local — two spans
that touch at a point and share nothing. Two readings side by side, never about the same
stretch of time, in a component whose entire job is to let you compare them.

## The rule

**Choose the period first, name it second.** `periodStartForInstant` (in `lib/time/cursor.ts`)
takes the period that *starts at or before* the instant — one rule for every country, no
labelling involved. `slotForInstant` then names that period the way the country names it:
period-start countries by its start, period-end countries by its end, a cadence later.

The cursor reads forward, the way a scrubber does: you are at T, looking at what happens from
T. A finer country's period now nests inside a coarser one's.

Same cursor, after: `GB 13:00–13:30`, `NL 14:00–14:15`. NL's quarter is inside GB's half hour.

## `periodForInstant` vs `periodForLabel`

These are two different questions and conflating them is the failure mode this whole area
keeps producing — including twice during the session that wrote it:

- **`periodForInstant(cursor, country)`** — a *cursor value*, always a period start under the
  shared rule. Returns the period beginning there.
- **`periodForLabel(label, country)`** — a *timestamp the country published*: a point in a
  series, a key in the chart's data. Returns the period that timestamp is the name of.

They agree on a period-start country and are a whole cadence apart on a period-end one. So the
mistake is invisible on NL and wrong on GB, which is exactly how it gets written.

Two live instances were found and fixed:

- `deriveDaylightWindows` (`components/shell/scrub-scale.ts`) was asking the cursor question
  about data points, putting every daylight window one period out on GB.
- `remix-line`'s new period band was asking the cursor question about `timeOfInterest`, which
  `pv-remix-chart` has already resolved to a label — so the chart drew 13:30–14:00 while the
  scrub bar drew 13:00–13:30, for one cursor.

**If you add a caller, decide which of the two you have before you type the call.**

## What else moved with it

- `cursorNow` floors instead of taking the next slot strictly ahead. It names the same period
  it always did — the one currently filling — spelled at the start, because every cursor value
  is spelled at the start now.
- `use-format-chart-data`'s past/future split compares against *data keys*, which are labels,
  so it runs `slotForInstant(cursorNow(...), country)`. Without that step a period-end country
  splits one period early.
- `pv-remix-chart` and `delta-view-chart` resolve `timeNow` the same way before handing it to
  the chart as the LIVE line's x, for the same reason.
- Every user-facing label is a **range** (Brad, 2026-09-01: "the label should always be the
  range for clarity"): the chart's cursor pill (`09:30–10:00`, and the pill's rect is sized
  from the text now rather than a hard `width="40"`), the scrub bar's tethered chip, the
  footer's per-country rows.

## Tests that were pinning the old behaviour

Six, updated deliberately rather than auto-fixed, each with the reason written into the test:

- `lib/time/cursor.test.ts` — `cursorNow` naming the filling period by its start; the boundary
  tie-break itself, pinned as its own case.
- `components/shell/cursor-readout.test.tsx` — the two rows now overlap instead of abutting.
- `use-gsp-deltas.test.tsx` and `use-map-region-values.test.tsx` — these fed a **published
  label** into a hook that takes a **cursor instant**, so the fixture constants moved back one
  index (`times_utc[19]` reads the value at `times_utc[20]` on GB). The same conflation as
  above, in the tests.

## Not done, and deliberately

**Plotting is still period-end for GB.** A GB point is drawn at the instant its period closed,
so the same x pixel is a different half of a period depending on the country. Normalising both
to period-start would line the curves up in real time and draw each value across the span it
covers. Brad's position (2026-09-01): the recalibration retains the meaning of the data, since
only the drawn position moves — the lookup, the labels and the API calls are untouched. The
costs are one-time: GB's peak moves half an hour left from where people are used to it, and it
stops matching NESO/PV Live charts if anyone compares screenshots. **Agreed in principle, not
built.** This is the obvious next step here.

**Scrub bar shows no period.** A band was built on the strip and removed: half an hour of a
3.5-day window is about four pixels, so it needed a 6px minimum width to be visible at all,
and a mark whose size does not mean anything is worse than no mark. The chart carries the band;
the footer readout carries the cross-country comparison in words. If the strip ever gains a
zoom, revisit — the code is in `ffd9eecd`'s parent history if wanted back.
