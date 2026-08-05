# v1 API fixtures

Recorded verbatim from **production** (`https://api.quartz.solar/v1`) with the
`QUARTZ_API_V1_TOKEN` in `.env.local`. Dev hosts reject this token (different Auth0
tenant). Re-record with:

```
node lib/api/v1/__fixtures__/record.mjs
```

The script is the source of truth for exactly which request produced each file — this
table mirrors it at time of writing (2026-08-05).

One caveat on "verbatim": the recorder pretty-prints each response through
`JSON.parse`/`JSON.stringify` for readability. This can only change *cosmetic* number
formatting — e.g. the wire sent `"gsp_id":67.0`, JS has no int/float distinction so it's
written back as `"gsp_id":67` — never a value. Confirmed by diffing a raw `curl` capture
against the recorder's output.

## Manifest

| File | Request | Size |
|---|---|---|
| `countries.json` | `GET /countries` | 3.8 KB |
| `sources.json` | `GET /sources` | 54 B |
| `gb-region-types.json` | `GET /GB/solar/region-types` | 1.7 KB |
| `nl-region-types.json` | `GET /NL/solar/region-types` | 0.9 KB |
| `gb-generation-sources.json` | `GET /GB/solar/generation-sources` | 192 B |
| `nl-generation-sources.json` | `GET /NL/solar/generation-sources` | 87 B |
| `gb-regions-national.json` | `GET /GB/solar/regions?region_type=national` | 179 B |
| `gb-regions-gsp.json` | `GET /GB/solar/regions?region_type=gsp` (full — 338 regions, no server-side count limit available) | 72.1 KB |
| `nl-regions-province.json` | `GET /NL/solar/regions?region_type=province` (12 regions) | 2.3 KB |
| `gb-region-citr_1.json` | `GET /GB/solar/regions/citr_1` (single region) | 188 B |
| `gb-national-forecast.json` | `GET /GB/solar/regions/national/forecast?start_utc=<yesterday 00:00Z>&end_utc=<today 00:00Z>` (default model, full day, 49 points) | 11.6 KB |
| `gb-national-forecast-last-updated.json` | `GET /GB/solar/regions/national/forecast/last-updated` | 23 B |
| `gb-national-generation-pvlive_in_day.json` | `GET /GB/solar/regions/national/generation?observer=pvlive_in_day&...` | 3.9 KB |
| `gb-national-generation-pvlive_day_after.json` | `GET /GB/solar/regions/national/generation?observer=pvlive_day_after&...` | 3.8 KB |
| `nl-national-generation-ned_nl.json` | `GET /NL/solar/regions/national/generation?observer=ned_nl&...` | 7.6 KB |
| `gb-gsp-forecasts-period.json` | `GET /GB/solar/forecasts/period?region_type=gsp&...&region_names=citr_1,brfo_1\|clt03,sjow_1,hack_1,hack_6` (server-side trim to 5, full 49-point time axis) | 5.3 KB |
| `gb-gsp-generation-period.json` | `GET /GB/solar/generation/period?region_type=gsp&observer=pvlive_in_day&...` (same 5 regions) | 5.0 KB |
| `nl-province-forecasts-period.json` | `GET /NL/solar/forecasts/period?region_type=province&...&region_names=zeeland,noord-brabant,limburg,friesland,drenthe` | 25.6 KB |
| `gb-gsp-forecasts-snapshot.json` | `GET /GB/solar/forecasts/snapshot?region_type=gsp` (one instant, 336 regions) | 32.7 KB |
| `gb-gsp-generation-snapshot.json` | `GET /GB/solar/generation/snapshot?region_type=gsp&observer=pvlive_in_day&time_utc=2026-08-05T13:00:00Z` (a settled slot: full 336-region coverage) | 33 KB |
| `gb-gsp-generation-snapshot-partial.json` | as above at `time_utc=2026-08-05T15:00:00Z`, recorded while that slot was still publishing — 127 of 336 regions. Kept deliberately; see finding 6 | 12.6 KB |
| `error-422-missing-required-query-param.json` | `GET /GB/solar/forecasts/period` (region_type omitted) — real 422 | 173 B |
| `error-400-unknown-region-type.json` | `GET /GB/solar/regions?region_type=bogus` — undocumented 400 | 85 B |
| `error-400-national-on-period-endpoint.json` | `GET /GB/solar/forecasts/period?region_type=national` — undocumented 400 | 208 B |

**Total: 194,419 bytes (~190 KB)**, well inside the ~1.5MB budget.

Nothing is missing: both `/forecasts/period` and `/generation/period` for GB gsp
recorded successfully as 200s (see "cache-backed 503s" below for why that took ~10
minutes and needed retries).

## Drift findings

These are the point of this exercise. Ranked roughly by how much they'd break a naive
client.

### 1. `period` endpoints reject `region_type=national` — undocumented, and architecturally significant

`GET /GB/solar/forecasts/period?region_type=national` returns **400**:

> `region_type='national' is not supported on the period endpoint (only sub-national
> region types are pre-warmed): ['gsp']. Use GET /GB/solar/regions/national/forecast
> for national-level data.`

The OpenAPI spec's `region_type` parameter for both `/forecasts/period` and
`/generation/period` is typed `enum: [gsp, province]` (no `national` in the enum at
all — so this is technically spec-consistent), but nothing in the spec's prose says
*why*, and the 400 status/body isn't documented (only 200/422 are declared for this
path). **This means the national-level chart cannot use the period-matrix endpoints at
all and must always go through `/regions/{region}/forecast` and
`/regions/{region}/generation`** — a real API shape, not an oversight to route around.

### 2. `period` and `snapshot` are cache-backed and cold-start with a retryable 503 — undocumented

Recording `gb-gsp-forecasts-period.json` and `gb-gsp-generation-period.json` hit
`503 {"detail":"Forecast cache is being populated, please retry in 60 seconds."}` /
`"Generation cache is being populated, please retry in 60 seconds."` on **every**
attempt for about 10 minutes straight (25+ retries, varying date windows and
`region_names`, including no `region_names` at all) before both caches warmed and
returned 200. The two caches warm **independently** — one was observed hot while the
other was still 503ing. Neither the 503 status, the message format, nor the "cache
populates lazily" behaviour is in the spec (only 200/422 declared).

**Client implication**: these endpoints — which the whole gsp/province migration
leans on — must treat 503 as retryable-with-backoff, not as a hard failure like 403/404.
`lib/api/v1/client.ts`'s error handling needs a path for this that's distinct from
ordinary HTTP errors.

### 3. Two distinct, undocumented error body shapes exist, plus the one documented one

- **Real 422** (`error-422-missing-required-query-param.json`, e.g. omitting a required
  query param): matches `HTTPValidationError` — `{"detail": [{"loc": [...], "msg": ...,
  "type": ...}]}`. This one's covered by the spec.
- **Undocumented 400** (`error-400-unknown-region-type.json`,
  `error-400-national-on-period-endpoint.json`): `{"detail": "<plain string>"}` — a
  flat string, not an array. Two different endpoints, two different messages, same
  shape. The spec declares no 400 response anywhere in the document.

A client (or the contract test, see below) that assumes every non-200 body is
`HTTPValidationError` will throw trying to read `.detail[0].loc` on a string. This is
exactly the kind of thing `lib/api/v1/client.ts`'s typed-error handling needs to
branch on — status code alone doesn't disambiguate (`400` is always the plain-string
shape in what we saw, `422` is always the array shape, but neither is spec'd, so this is
observed behaviour, not a contract).

### 4. Timestamp spelling is uniformly `Z`, never `+00:00`

Checked every timestamp field (`time_utc`, `times_utc`, `last_updated_utc`,
`latest_init_utc`, `cache_updated_utc`) across all 10 fixture files that carry
timestamps — **100% use the `Z` suffix** (e.g. `2026-08-04T00:00:00Z`,
`2026-08-05T15:02:55.710713Z` with fractional seconds), **zero** instances of `+00:00`.
This matters because the v0 API (superseded by this v1 API) emits `+00:00`, and
`lib/domain/time.ts`'s canonicaliser exists specifically to normalise both spellings to
one — this confirms the divergence is real and live, not a latent worry: any code path
that string-compares timestamps instead of going through the canonicaliser (e.g. as a
chart merge key) will silently fail to match v0-shaped and v1-shaped data, and this
fixture set is what pins that down as fact rather than assumption.

### 5. `plevels_kW` key sets are inconsistent — no fixed percentile set, and no p50 anywhere

- **GB national forecast** (`gb-national-forecast.json`): plevels present on every
  value, keys `p2, p10, p25, p75, p90, p98` — six keys, **no p50/median**.
- **GB gsp** (period matrix and snapshot, both): `plevels_kW` is **always** `{}` (period)
  or `null` (snapshot) — gsp-level forecasts carry **no** percentile bands at all, for
  all 5 sampled regions / all 336 snapshot regions.
- **NL province** (`nl-province-forecasts-period.json`): plevels present, but only
  **two** keys, `p10, p90` — different count and different key set again.

A client cannot assume a fixed plevels shape by region type or country; the schema
(`additionalProperties: number`, correctly modelling this as an open map) is right, but
any UI that hardcodes "the median is `p50`" or "there are always N bands" will break.
Also worth flagging: `power_kW` itself has no explicit "central estimate" percentile —
whatever `p50` would be is simply absent, so `power_kW` is presumably already the point
estimate.

### 6. The most recent generation slot publishes region by region, so it can be read mid-fill

`gb-gsp-generation-snapshot-partial.json` caught the `2026-08-05T15:00:00Z` slot with
only **127 of 336** regions present, against **336** in the forecast snapshot for the
identical instant.

**This is publishing lag at the leading edge, not a coverage gap** — an earlier draft of
this document read it as a standing 62% hole, which was wrong. Re-probing the live API
settled it:

| request | at 15:13 UTC | at 15:24 UTC |
|---|---|---|
| `generation/snapshot` @ `15:00Z` | 127 regions | **336 regions** |

Every earlier slot today, and every slot on previous days, returns the full 336. The
cache writes values per region as they arrive and never blanks or zero-fills, so a
partial read means "these regions have not published yet", never "these regions are
empty" — all 127 present regions carried real non-null values.

What a client must do about it: the regions still to publish are **absent from the
payload entirely**, not present with a `null`. Code that only checks for null values
will not see them. "Not yet published" has to render differently from "no data", and
neither may be drawn as a zero.

Both states are kept as fixtures deliberately:
- `gb-gsp-generation-snapshot.json` — a settled slot (`13:00Z`), full 336-region coverage.
  This is the normal case; use it as the default fixture.
- `gb-gsp-generation-snapshot-partial.json` — the mid-publish transient, for testing the
  leading-edge state the UI genuinely hits.

The 2 gsp regions absent from even the *forecast* snapshot (`dube_p`, `impk_1`) both
have `capacity_kW: 0.001` in `gb-regions-gsp.json` — negligible/placeholder GSPs,
plausibly excluded from forecasting deliberately rather than a gap.

### 7. `horizon_minutes` is absent, not null, on the national forecast

`ForecastResponse.horizon_minutes` is documented as nullable (`anyOf: [integer, null]`,
not in `required`). The real `gb-national-forecast.json` response **omits the key
entirely** rather than sending `null`. Not a schema violation (optional fields may be
absent), but worth knowing if any code does `"horizon_minutes" in response` rather than
`response.horizon_minutes == null`.

### 8. Facts 1–8 from the plan doc — confirmed, one nuance

All of facts 1–8 hold against these fixtures:

1. **Confirmed.** `gb-regions-gsp.json` has 26 pipe-joined composite names among 338
   entries, e.g. `brfo_1|clt03`; plain lowercase codes otherwise (`citr_1`, `sjow_1`).
2. **Confirmed**, with a caveat: `metadata.gsp_id` is present on all 338 gsp regions —
   but the *wire* representation is a JSON float (`67.0`), not an int, even though the
   value is integral. `RegionDetail.metadata` is typed
   `additionalProperties: anyOf[string, integer, number]` so this validates either way,
   but a client doing strict type narrowing on "integer" would be wrong to assume the
   wire sends one.
3. **Confirmed.** `metadata.full_name` present on all 338 gsp regions (0 missing),
   e.g. `"City Road"` for `citr_1`.
4. Not directly re-verified here (needs the GeoJSON join, out of this task's scope) —
   no new information either way.
5. **Confirmed.** `gb-generation-sources.json` has 2 entries
   (`pvlive_in_day`, `pvlive_day_after`); `nl-generation-sources.json` has exactly 1
   (`ned_nl`).
6. **Confirmed exactly.** From `countries.json`: GB `national` → 12 models, default
   `blend_adjust`; GB `gsp` → 3 models (`blend`, `pvnet_intraday`, `pvnet_day_ahead`),
   default `blend`. NL `national` → 4 models default `blend_adjust`; NL `province` → 2
   models default `blend`.
7. **Confirmed.** `level: 0` for both GB and NL `national`; `level: 10` for GB `gsp`
   and NL `province`.
8. **Confirmed.** `gb-regions-national.json` region is named `"Great Britain"`, and
   `/GB/solar/regions/national/forecast` (using the `national` alias) resolves and
   returns real data.

### Other checks that came back clean (no finding, stated for completeness)

- **Time axis spacing**: GB (both forecast and generation) is evenly spaced at 30-minute
  intervals, no gaps, no duplicate timestamps, across every GB fixture checked. NL is
  evenly spaced at **15-minute** intervals (97 points across the day vs GB's
  48/49) — a real, and previously undocumented in the plan, resolution difference
  between countries worth carrying into any shared time-axis logic.
- **`power_kW` magnitudes**: GB national peak on the recorded day was ~8.7M kW (8.7 GW)
  against `capacity_kW: 21.9M kW` (a ~40% capacity factor) — plausible, on the low side
  of the plan's "10–12 GW" figure but that was presumably a different/sunnier day, not a
  units error. NL national peak ~18.4M kW against `capacity_kW: 25.1M kW` (~73% capacity
  factor) — also plausible. No sign of an MW/kW mix-up in either country.
- **Region name casing**: consistently lowercase for GB gsp (`citr_1`), lowercase for NL
  province (`zeeland`, `noord-brabant`), `"Great Britain"` / `"Nederland"` /
  `"National"`-style casing only at the national/country level. Consistent with fact 1's
  case-insensitive join.
