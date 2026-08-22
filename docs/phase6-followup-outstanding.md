# Phase 6 followup — what is outstanding

Written 2026-08-13, at the end of a long live-pass session. Everything below is either something
Brad raised and parked, something an agent flagged and did not fix, or something I proposed that he
has not answered. Nothing here is in flight; the tree is committed and green.

**State of the branch:** `epic/adaptive-eu-ui`, unpushed. Jest **1173 passed / 52 suites**,
`next lint` 16 warnings / 0 errors, `yarn tsc --noEmit` clean except the known pre-existing
`jest.globalSetup.ts(14,1) TS1208`. `next build` green — but note that **concurrent `next build`
runs produce false failures**; three separate agents misreported build state this session by
racing each other over `.next`. Tests and typecheck are reliable under concurrency; builds are not.

---

## 0. Start here next session

**Merge the forecast and delta maps into one** — see `docs/forecast-delta-merge.md`, written
2026-08-15 to be picked up cold. It carries the plan, an intent-vs-accident classification of every
difference between the two components, and a Delta v2 prep section recording how delta actually
works today (notably: **the chart and the map compute different deltas under the same name**).

The camera-reset half of that problem is already fixed (`d1dd82d`); the remount flash is what
remains.

## 1. Blocking something else

**~~The pre-warm cache is stale, API-side.~~ RESOLVED 2026-08-21 — and it was a v1-only problem.**

**Root cause: the refresh DAG was never switched on for GB** (Brad). Not a cache-invalidation
subtlety and not a client bug — which is what the symptom said in hindsight: GB per-GSP
`generation/period` returned zero slots with `cache_updated_utc` ~20 hours old while GB forecast and
both NL endpoints were fresh within the hour, and a manual refresh did not take. One endpoint, one
country, stuck rather than lagging.

**Nobody was ever affected. The live GB UI runs on v0**, so this was a development-environment
symptom throughout. Recorded because of what it cost and what it confirmed: the whole client path
was verified along the way — the join, the normalisers, the observer parameter, the per-country
region types — so "the delta map draws GB uncoloured while NL fills normally" is now a **known
symptom of a backend freshness problem**, not an open question. If it recurs, check the DAG first.

> **Do not attach FB-044 to this.** FB-044 (Matt @ EDF, Mar 2026 — the trading-floor screen
> "persistently loading data") is a **v0** problem; this is a **v1** one. Its cause was **v0's
> `/forecast/all` being slow and heavy, and not reliably cached**, upgraded ahead of schedule in the
> run-up to the DP release — and that is what closed the customer's complaint. Two separate issues;
> only one of them ever reached a user.

**Germany.** Unblocked now that MW bands are per-country config (followup Track K). It should be one
`COUNTRY_CONFIG` entry plus geo assets plus an Auth0 role. Track K's notes list exactly what a new
country must supply.

**The narrow (`<lg`) stage needs designing, not patching.** Raised 2026-08-14, while moving the
floating chart from the bottom edge of the stage to the top. Wide layouts are fine — the chart caps
its width short of the map control dock and grows downward. Narrow is not: the chart is full width
at its seed height, so the map it is a readout *of* is left as a strip, and Brad's read is that
this "covers far too much for the map" and "needs specific rules and relationships with other
elements (and user controls) to work on smaller screens." That is a stage design — how chart, map
control dock and display rail give way to each other, and what the user gets to drive it with —
not an anchor tweak. **In the meantime** `floating-chart.tsx` keeps the *bottom* anchor below `lg`,
which does nothing except stop the chart covering the top-right control dock; it is labelled in
that file as a holding position. Do not build on it.

## 2. Decisions Brad has not made

- **Does `/sites` get a footer?** It came up twice today. It has no scrub track, no `now`, no
  tethered reading — just a play button (Track P kept it there deliberately rather than deleting a
  feature). Separately, Track J left its time axis on its own numeric branch: 6-hourly ticks
  always, no narrow fallback, and anchored to the *viewer's* zone rather than the country's. If
  `/sites` gains a footer, do both together.
- **Footer direction 3**, explicitly parked ("come back to 3"): collapse the readout to one clock,
  with the other countries behind a compact lag marker (`NL +1h`) rather than full times. The zone
  stack shipped instead, which is the always-visible option.
- **The delta strip's "no delta right of NOW" band.** Track O skipped it to protect the layer
  hierarchy — a fifth ground layer would have muddied the strip. It is the one layer that would
  have shortened the debugging session in §1.
- **Should Clouds default *on*?** `showCloudLayer: false` predates this work entirely (it comes
  from the original satellite commit). Brad called clouds a flagship feature; the control is now
  always visible, but the layer still starts off.

## 3. Flagged by agents, not fixed

- **`MAP_CONTROL_HEIGHT_RESERVE_PX` is still a constant (350)**, sized for the map panel
  *expanded*, while it is collapsed by default. Track L narrowed *when* it applies (only when the
  chart's width actually overlaps the dock's column, which is what unblocked the 90% seed) but
  could not measure the dock's live height without editing a file it did not own. A
  `ResizeObserver` publishing the dock's height would tighten it.
- **The colour key disappears when the display rail is collapsed.** Track G moved the chart's
  legend into the rail's series toggles; with the rail shut, nothing on screen names the line
  colours.
- **Two dead files**: `components/charts/LegendTooltipContent.tsx` and `LegendTooltop.tsx` became
  unreferenced when `ChartLegend` was deleted.
- **The camera reads chrome by `aria-label`.** `map.tsx` finds `[aria-label="Chart"]` and
  `[aria-label="Map controls"]` to work out what covers the map when framing countries. Renaming
  either label silently stops the camera accounting for it. Commented at both ends; still a
  coupling the type system cannot see.

## 4. Tuning, from the mock

Values chosen by eye late in the session and worth a second look in daylight: daylight shading at
`14%` yellow (it was 6%, which was invisible — a jump of more than 2×, so overshoot is plausible),
the strip at 40px, the tethered tag's edge re-anchor threshold at 10%, and whether `now` reads
correctly now that it hides itself while live.

## 5. A sweep worth doing

**GB-shaped assumptions in `components/charts/`.** Four separate bugs today were the same shape,
and each failed silently rather than loudly:

| Assumption | Where it bit |
| --- | --- |
| `"gsp"` as *the* region type | selected-region chart, delta hook — 400s for NL |
| `gsp_id` as *the* region identity | delta table dropped all 12 NL provinces |
| `pvlive_in_day` as the observer default | map values, delta hook, loading indicator — 400s for NL |

The map layer was swept during Phase 6 Track F; the chart layer never was. A deliberate pass over
`components/charts/` for those three would likely find what is left before a user does.

## 5b. Verify before building on it — GB market auction times and BST

**Not now. Do it before anything is built against market deadlines, and do not lose it.**

Raised 2026-08-15 while adding the GB intraday market clock to the user-research work (see
`docs/feedback/FEEDBACK-MATRIX.md` §6b, untracked). EPEX's Focus GB diagram labels every GB auction
time "GMT", which invites storing them as fixed UTC constants. That reading is wrong, and wrong in
the direction that fails silently for seven months of the year.

**What is already established:** SDAC's gate closure is anchored to **12:00 CET**, not to a UTC
instant — 11:00 GMT in winter, 11:00 BST in summer (12:00 CEST = 10:00 UTC). The UK and EU change
clocks simultaneously at 01:00 UTC on the same dates (Directive 2000/84/EC), so the GB↔CET offset
is a constant hour and a CET-anchored deadline sits at a **constant UK local time**. EPEX's "GMT"
label is a winter snapshot. Store as `Europe/London`, convert at use.

**What is not established, and is the actual check:** that reasoning is proven for SDAC only. The
GB-only auctions — EPEX 30-min intraday 08:00 and 17:30, EPEX 60-min day-ahead 09:20, EPEX 30-min
day-ahead 15:30 — and N2EX's 09:50 have no published DST statement either way. The constant offset
means CET-anchoring and UK-local-anchoring give an identical answer; only UTC-anchoring would
differ.

**The check, when someone gets to it:** pull a published auction result timestamp from July and one
from January and compare. Five minutes against real data, and it settles it definitively. Worth
doing because this repo has form here — audit B2 was date helpers rounding in the viewer's local
zone before converting to UTC, and the jest suite silently ran in machine-local time until
`globalSetup` pinned it.

**Trigger:** any feature that displays, counts down to, or aligns anything with a market deadline.
Until then it changes nothing.

## 5c. Re-validate the map thresholds once there is more than a week of data

**Not blocking. Re-run when a season's worth of history is reachable.**

Raised 2026-08-15 while re-placing the `%`-of-capacity bands. The proposed set
(`[3, 10, 20, 30, 40, 50, 70]`, eight bands) beats the current `[10, 20, 35, 50, 70]` on every day
tested — but that is **six days, four of them in a single August week**, plus one December day
built from snapshots. "Robust across six days" is not "robust".

**What is safe to rely on** (structural, sample-independent):
- MW-as-fill correlates 0.93–1.00 with installed capacity at every daylight hour. That is a fact
  about the capacity distribution, not about a day's weather.
- Only the *first* threshold is load-bearing. Moving it from 3 to 5 doubles the December
  bottom-band share (14% → 26%); everything above it can be rounded freely with no measurable cost.
- Spatial spread is a property of the **weather regime, not the country** — NL's twelve provinces
  spanned 2pp one day and 55pp the next.

**What needs more data:** the threshold values themselves, and whether eight bands still earns its
extra steps outside August. December's median is 6% of capacity against August's 35%, so the shape
of the distribution moves enormously across the year and two seasons is a thin basis.

**Why it did not get done now:** the dev API's retention is short — `period` returned nothing before
roughly 13 Aug, and the December day had to be assembled from 26 individual `snapshot` calls at
5 req/s (`scratchpad/pull-day-snapshots.mjs` does this and resumes after a token expiry).

**The check:** pull a spread of days across all four seasons — prod history if it is reachable,
otherwise re-run the snapshot builder each month — and re-run the comparison in
`docs/feedback/FEEDBACK-MATRIX.md` §6b's companion analysis: bands used, largest single band, and
top-band share at peak. **Watch the largest-band figure, not a flat/not-flat count** — an 80%
threshold missed a 58% pile-up during this session and gave a false pass.

**Trigger:** before the thresholds are treated as settled, or at the next seasonal turn, whichever
comes first.

## 5d. An "as at" time control — replay the data as it stood earlier

**Idea, not a decision. Nothing depends on it; raised so it does not get lost.**                                                                                                                     
                                                                                                                                                                                                     
Raised 2026-08-15 (Brad). Today the cursor moves along the *target* axis: it picks which                                                                                                             
half-hour of generation you are looking at, always as described by the **latest** forecast run.                                                                                                      
There is no way to ask the opposite question — *what did we think at 09:00 this morning?* — which                                                                                                    
means the UI can show what happened but not what anyone knew at the time.                                                                                                                            
                                                                                                                                                                                                     
**Why it is worth a thought:**                                                                                                                                                                       
                                                                                                                                                                                                     
- It is the missing half of the revision question the corpus keeps raising. David at NESO reports                                                                                                    
"very large revisions of the forecasts as we progressed through today" and wants deltas against                                                                                                    
the 8h, 4h and 24h-ahead forecasts (`docs/feedback/FEEDBACK-MATRIX.md` RS-8); Archy's "lo-fi                                                                                                       
alert" was Peter messaging him that the forecast had moved overnight. Both are asking to see a                                                                                                     
past state of the forecast, not a past target time.                                                                                                                                                
- It is also how a miss gets defended. "The 11:45 run had it at 3 GW" is a different and more                                                                                                        
useful statement than "it turned out to be 4 GW", and the control room's decisions fix at the                                                                                                      
4-hours-ahead point, so the forecast *as it stood then* is the one they acted on.                                                                                                                  
- The chart already holds the concept — `PAST_FORECAST`, and sites' N-hour-ahead horizon — so                                                                                                        
this is partly surfacing something the data model understands and the UI does not expose.                                                                                                          
                                                                                                                                                                                                     
**What it is not:** not the existing scrubber with a different label. Two independent axes —                                                                                                         
target time and run time — and conflating them is the easiest way to build something that looks                                                                                                      
right and answers neither. Worth being explicit about which one a given control moves.                                                                                                               
                                                                                                                                                                                                     
**Open questions before any design:**                                                                                                                                                                
                                                                                                                                                                                                     
- Does the v1 API serve a forecast *by init time*, or only the latest run per target? If not, this                                                                                                   
is an API ask first and a UI question second.                                                                                                                                                      
- Does it apply to the map, the chart, or both? A per-run map is a much heavier data path than a                                                                                                     
per-run national series.                                                                                                                                                                           
- Does it interact with the country cadence work? GB publishes every 30 minutes, NL every 15, so                                                                                                     
"as at 09:00" resolves to a different run per country.                                                                                                                                             
                                                                                                                                                                                                     
**Trigger:** revisit alongside Delta v2 (contract OPEN 9) — they are the same underlying axis, and                                                                                                   
designing one without the other risks two controls that mean nearly the same thing.

## 5e. Persist User Presence to the Status DB

**Raised 2026-08-21 (Brad). Not blocking anything; the highest-leverage item on this list.**

`components/presence/` opens a websocket to the status API and pushes a settings snapshot on
connect, **on every change** (`setMeta` calls `sendPresence()` synchronously) and on a 5-second
heartbeat. Today it is **in-memory only** — a live view plus sessions since the API last rebooted.
Persisting it turns most of our standing design arguments from inference into measurement.

A first export is in `docs/feedback/data/presence_2026-08-21.json` (untracked): 29 users, 663
sessions, 11–21 Aug 2026. Findings are written up in `docs/feedback/UI-EVIDENCE-AUDIT.md` §5c.
**It already changed two conclusions**, so this is not speculative value.

### What it already answers

`PresenceMeta` carries `email`/`domain`, `view`, `mapUnit`, `aggregation`, `visibleLines`,
`nHourForecast`, `showNHourView`, `selectedTime`, `selectedRegionIds`, `dashboardMode`, plus
`connectedAt`/`lastSeenAt`/`disconnectedAt`/`durationMs`/`ip`/`userAgent` server-side.

That is enough for: unit occupancy (RS-2/RS-3), whether regions are ever selected (T-1), whether
any aggregation level but the default is reached (FB-025), which series people actually keep on
(FB-048/FB-077), session shape and time-of-day (§3 rhythms, FB-016), and Forecast/Delta/Sites
occupancy (T-2).

### Six fields to add

`presenceMetadataBridge.tsx` already holds all of these in scope; each is one line.

1. **`country` / `enabledCountries`** — **the important one, and it is currently absent.** There is
   no country dimension in the payload at all, so the export cannot say whether anything observed
   was GB or NL. For the epic this phase exists to serve, that is the first thing we would want to
   segment by. Add before anything else. (`domain` is a *partial* signal already — a session on
   `nl.quartz.solar` is an NL session — but it is host-granularity, and one host can now have
   several countries enabled with one focused. See below.)
2. **`org`** — the customer's organisation, derived from the email domain client-side. Today it can
   only be recovered from the raw address, which is the field that should stop being persisted;
   sending `org` alongside `userHash` keeps all the segmentation value with none of the
   identifiability. Not to be confused with `domain`, which is the deployment host.
3. **`chartSplit`** — the committed per-mode split (`CookieStorageKeys.CHART_SPLIT_OVERRIDES`).
   The only direct evidence on the map-as-ground question (audit §3.1a), and it is persisted
   already, so it is a read not a new concept.
4. **`showCloudLayer`** (+ `activeChannel`) — settles "should Clouds default on?" (§2 above) by
   showing whether anyone turns it on when it starts off.
5. **`showConstraints`** — whether the overlay is used, before building the summation half.
6. **`displayPanelOpen`** — does anyone open the display rail? This underwrites the whole
   what/how control split and the chart-legend decision.

### Three decisions before the first write

**1. Store the change stream, not the latest state — the current export proves the point.**
Each session in the export is a **single final-state snapshot**: `sessions[]` holds one object per
session with the values as they were at disconnect. Every transition inside a session is already
lost. So "did they *change* the unit" is unanswerable today; only "what did it end on" survives.

Since `setMeta` already sends on every change, the transitions are on the wire — the fix is
storage shape, not instrumentation. **Persist each distinct payload with a receive timestamp, and
dedupe identical consecutive messages server-side.** Dedupe is also the volume fix: at a 5-second
heartbeat an idle client emits ~720 near-identical messages an hour, and one session in this
sample ran **34 hours**.

**2. Hash the email. Treat as a blocker.** `presenceClient.ts` sends a raw address and carries a
commented-out SHA-256 path. Holding that in memory for a live view is one thing; **persisting
identifiable behavioural records about named customers' employees** needs a lawful basis, a
retention period and a deletion route, decided before the first row lands rather than after. The
export also carries **`ip` and `userAgent`**, which the in-app `PresenceMeta` type does not mention
— worth checking what else the server adds.

It costs nothing analytically: **every question we have is answered at `domain` level.** Keep
`domain` (derived from the email domain, not `window.location.host` — see the bug below), switch
the address to `userHash`.

**3. Do not read dwell as engagement.** The longest session in the sample is 34 hours — a screen
left open, which is exactly FB-043's trading-floor case. Duration measures the screen, not
attention. *Whether anything is ever touched* is the reliable signal.

### What `domain` is actually for — and what it shows

**Corrected 2026-08-21 (Brad).** An earlier draft of this section called `domain` a bug because
every record reads `app.quartz.solar`. It is not. `window.location.host` is **deliberate**: it
records *which deployment* the session was on — `nl.quartz.solar`, staging, and so on — and staging
still points at the prod APIs, so knowing the host is the only way to tell real usage from our own.

Two consequences worth recording, both of which the export makes concrete:

- **All 663 sessions were on `app.quartz.solar`.** Nobody was on `nl.quartz.solar` in this ten-day
  window. That is the plainest explanation for why there is no NL signal anywhere in §5c of the
  audit — and it is worth knowing before anyone reads the absence as a statement about NL demand.
- **Staging traffic is indistinguishable from production usage in every metric except this field.**
  Since staging hits prod APIs, any usage analysis has to segment or exclude by host, or our own
  testing inflates the numbers. With 79% of this sample internal, that is not a hypothetical.

`domain` is also a **partial country signal already** — a session on `nl.quartz.solar` is an NL
session. But it is host-granularity, and the multi-country work means one host can now have several
countries enabled with one focused, so it does not replace the `country` / `enabledCountries` field
above. Keep both: `domain` answers *which deployment*, `country` answers *what they were looking
at*.

**What is missing is a separate `org` field.** Today the customer's organisation can only be
recovered from the email address — which is exactly the field that should stop being persisted.
Deriving `org` from the email domain client-side and sending it alongside `userHash` gives all the
segmentation value with none of the identifiability.

### One thing that does look wrong

`byView`, `byAggregation`, `byNHourForecast` and `byVisibleLine` are all `{}` in the export while
`totalActive` is 5 and `users` has 5 populated entries. The rollups appear unpopulated API-side.

### Where the persisted data should live

**Raised 2026-08-21 (Brad):** presence sits on the Status API side rather than in the main AWS
estate, which "feels slightly not with our other production code/data".

**What is visible from this repo, and what is not.** The client connects to
`NEXT_PUBLIC_STATUS_URL` with `http`→`ws` and a `/ws` path (`presenceProvider.tsx:7-8`). The app
also talks to `NEXT_PUBLIC_API_PREFIX` (v0), `NEXT_PUBLIC_API_V1_PREFIX` and
`NEXT_PUBLIC_SITES_API_PREFIX`, and deploys to Vercel (`VERCEL_URL`). **There is no infrastructure
code in this repo** — the only workflows are the contribution bot and the test run — so deployment
topology, the Status service's hosting and the Status DB are not inspectable from here. What
follows reasons about the shape of the data, not about the estate.

> **⚠️ Fix before persisting anything: the websocket is unauthenticated.**
>
> `presenceClient.ts` opens `new WebSocket(this.wsUrl)` with **no token, no `Authorization`, no
> handshake** — and `email` arrives as a field in the client-sent payload
> (`presenceMetadataBridge.tsx:28`). For an in-memory live view that is low-stakes. **Persisting it
> means durably storing unauthenticated client assertions about who a named customer's employee
> is.** Anyone who knows the URL can write rows attributing behaviour to any address they like.
>
> It also undercuts the data: an identity field nobody verified is a poor basis for segmentation.
> Worth confirming whether the Status service authenticates the upgrade some other way (a cross-site
> cookie would not be reliable here); if not, this is a prerequisite rather than a follow-up, and it
> belongs with the email-hashing decision above.

**On placement, the useful reframe.** The instinct that it is in the wrong place is probably not
about the *database* — it is that the Status service sits outside the infra-as-code, backup,
monitoring and retention story production has. That is an **ops-maturity** gap rather than a
placement one, and the two are worth separating, because there is a positive reason to keep this
data away from production forecast data:

- It is about **users**, not the grid — different retention, different legal basis, different
  consumers (us, never customers).
- It is **write-heavy, low value per row, and never served**. Forecasts are the opposite on all
  three.
- Co-locating creates a path where a customer-facing query could join against behavioural records
  about named individuals. A boundary here is a feature, not an accident.

**Three options, and what decides between them:**

| Option | For | Against |
|---|---|---|
| **1. Persist on the Status side**, own store, but bring the service into the same IaC, deploy, secrets and backup discipline as production | Fewest moving parts — the socket already terminates there, and moving the socket is the expensive part | Only sensible if Status is a service we intend to keep investing in |
| **2. Persist into the main estate** as a **separate datastore** — same account and operational discipline as production, own database, own retention and deletion policy | Gets the ops story, keeps the data boundary | More plumbing: Status needs a route into that estate |
| **3. A managed analytics product** | Least build | **Reintroduces exactly what the email-hashing decision avoids** — identifiable behavioural data about named customers' staff, in a third party. Recommend against for this dataset |

**The deciding question is whether Status is a real service in the estate or a sidecar.** If it is a
sidecar, do not grow it — take option 2. If it is a service we are keeping, option 1 is honest and
cheaper, *provided the ops gap is closed rather than inherited*.

**The shape matters more than the location.** This is an append-only event log with a session
dimension, and after the dedupe above the volume is small. **Almost any Postgres does the job** — so
choose on operational grounds (where does it get backed up, monitored and deleted on schedule?)
rather than technical ones. The one real constraint is **per-user deletion for GDPR**, which argues
for a relational store over a log or blob dump, and which is much easier if `user_hash` is the only
identity column.

> **Also worth checking before we describe ourselves as having no measurement.**
> `pages/_app.tsx:39` mounts `<GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />`, and
> there is a `NEXT_PUBLIC_LINKEDIN_PARTNER_ID`. What those containers actually collect is configured
> outside the codebase and cannot be determined from here. Worth a look for two reasons: there may
> already be usage data nobody is reading, and — given the privacy framing above — it is worth
> knowing what an authenticated customer tool is sending to third parties.

### Recording it efficiently

The naive shape — one row per websocket message — stores ~720 near-identical rows per hour per
idle client, and one session in this sample ran **34 hours**. Three rules avoid that, and the first
one also makes the most-asked question trivial to answer.

1. **Never store a heartbeat as an event.** A heartbeat whose payload is unchanged should only bump
   `last_seen_at` on the session row. No event row.
2. **Store the diff, not the snapshot.** Server-side, compare each incoming payload to the last
   stored state for that `session_id` and write only the keys that changed. This is a large volume
   saving, and — more usefully — **the event table then literally is the answer to "does anyone
   touch the controls?"** A session with zero event rows never changed a setting. T-1 becomes a
   `COUNT(*)`.
3. **Two tables.**
   - `presence_session` — one row per session: `session_id`, `user_hash`, `org`, `host`
     (`domain`), `user_agent`, `connected_at`, `last_seen_at`, `disconnected_at`, `duration_ms`,
     plus the *initial* state so a no-event session is still fully described.
   - `presence_event` — `session_id`, `received_at`, and the changed keys only.

   Sessionisation needs a merge rule at write time or the counts inflate: consecutive sessions from
   one user in this export overlap by a second or two on reconnect, so **663 raw sessions across
   ten days is mostly reconnect churn, not visits.** Merging reconnects from the same user within a
   short gap is the difference between "663 sessions" and a real visit count.

4. **Retention split.** Raw events short-lived (90 days is plenty for design questions), with daily
   per-org rollups kept indefinitely. The rollups are what answer "did behaviour change after we
   shipped X", and they are tiny.

**Timestamp the receive, not the client.** The payload carries no clock of its own, and the horizon
metric in §5c of the audit (`selectedTime` minus wall-clock) is only meaningful against a
server-side `received_at`.

### Also worth knowing

`view` is still the free-form legacy string (`FORECAST` / `DELTA` / `SOLAR SITES`), kept
deliberately for external consumers per the comment in `presenceMetadataBridge.tsx`. If the DB
becomes the new consumer, decide whether that pins the vocabulary permanently — post-Wave-4 the
app no longer thinks in those three views (comparison is an encoding, sites is a route), so the
labels already describe a model we have moved off.

## 6. Older open questions, still open

From the contract: **OPEN 8** region types across countries; **OPEN 9** the full A/B comparison
picker (Delta v2 — Brad's "circle back"); **OPEN 10** the sites zoom bands. **OPEN 7** is partly
answered by the coverage indicator but not for the chart. Also still queued: entitlement moving
into `setEnabledCountries` when the Auth0 `countries` claim ships (which retires the temporary
`NEXT_PUBLIC_DEV_ENTITLE_COUNTRIES` override, commit `117f5aa`); whether `MeasuringUnit` may edit a
non-focused country's aggregation level; the constraints overlay being focused-country-only; and
the hydration errors Brad parked ("4 errors" toast, dev only).

---

## How to work on this, per Brad

**Reason about design before building it, not after.** Twice this session a design decision was
made inside an agent brief and explained afterwards — hiding the Clouds toggle, and the footer
rework. His words: "this is exactly the sort of thing I would want to reason with you *first*,
rather than jumping in at once and having to try to work backwards through your logic and read a
wall of text about decisions made without me."

**Values need to be seen, not argued.** The footer's layering was carefully reasoned and then
rendered at opacities where the reasoning was invisible: "the code might be better than the final
effect". Build the mock, leave it uncommitted, and iterate one change at a time with him driving.
