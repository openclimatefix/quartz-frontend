# Phase 5 — review checklist

For Brad's live pass against prod. Companion to `phase5-progress.md` (what landed) and
`phase5-contract.md` (history). Written 2026-08-10 against `epic/adaptive-eu-ui` @ `96a4614`.

**Setup:** `cd apps/nowcasting-app && npx next dev`. `.env.local` already has
`NEXT_PUBLIC_MAPBOX_TOKEN` and `NEXT_PUBLIC_DEV_ENTITLE_COUNTRIES=GB,NL` — the latter is the
uncommitted dev override that lets you see NL before the Auth0 `countries` claim ships. Do **not**
set `NEXT_PUBLIC_DEV_MODE`; it swaps in `FAKE_TOKEN` and every API call 401s.

The three big behavioural changes are all *asynchrony where there used to be none*. That is what
this pass is really testing: geometry, groupings and seasonal norms now arrive over the network
after first paint. Anything that flashes, blanks, or renders once and never updates is the
interesting failure.

---

## 1. Geometry now arrives late (the main risk)

Watch the network tab on first load — `/geo/**` should be fetched, not bundled.

- [ ] **GB Forecast view, GSP level.** Boundaries draw; every region takes a colour, none stay grey
      once data lands.
- [ ] **Switch level GSP → Zone → DNO → back.** Each switch fetches its asset once; re-switching
      does not refetch. No stale geometry from the previous level lingering.
- [ ] **Scrub the time slider hard** immediately after a level switch. This is the `isSourceLoaded`
      hazard — feature-state applied against geometry that is about to be replaced. Symptom would be
      a whole map going uncoloured while the slider keeps moving.
- [ ] **Hard-refresh on a throttled connection** (DevTools → Slow 4G). The map should come up empty
      and fill in, never error, never point a layer at a missing source.
- [ ] **Constraints overlay** (NG constraints) toggles on and off cleanly.

## 2. NL

- [ ] Country switch GB → NL. **12 provinces draw and all 12 take values** — the join is on
      lowercased `name`.
- [ ] The region-level control reads **"Province"** for NL (from the manifest) and **"GSP"** for GB
      (a registry override, not a hardcode). GB should never flash "Gsp" before settling.
- [ ] **NL charts show no seasonal-norm series at all.** Previously it was drawn with *GB's* norms —
      this is the bug fix most worth eyeballing. GB's norms should be unchanged.
- [ ] NL national chart matches prod values.
- [ ] Switch NL → GB → NL a few times; no cross-country bleed of geometry, values or norms.

## 3. The capacity number changed

- [ ] **National capacity now reads ~21,783 MW, was 22,588 MW.** This is intended: six legacy
      merged/duplicate GSP regions are excluded, per your ruling that the 2026 NESO file is
      canonical. Confirm you're happy with the published figure moving.
- [ ] Regional capacity totals on the GSP map look sane against prod.

## 4. Views and peripherals

- [ ] **Delta view** — map colours, chart, and level switching all behave as in Forecast.
- [ ] **Solar Sites view** — sites render, the zoom slider still bands correctly. Sites now use the
      same canonical GSP asset as everything else (the 2022 `sites-gsp.json` vintage is deleted), so
      site-to-region assignment near changed boundaries is worth a look.
- [ ] **Satellite** layer loads.
- [ ] **Status banner** renders.
- [ ] **CSV export** on each view.

## 5. Bundle (already measured, confirm it feels right)

`/` First Load JS 11.6 MB → **828 kB**; `/404`, `/expired`, `/logout` 4.83 MB → **~245 kB**.

- [ ] The login/logout screens should now be visibly instant.

---

## Known-open, do not raise as bugs

These are recorded in `phase5-progress.md` §Open and are deliberately unresolved:

1. **−122 MW coverage gap** (Seabank, `grem_p`) — needs data, not code.
2. **Mapbox token rotation** — it was hardcoded, so it is in git history. `pk.` public token, so
   billing abuse rather than data access. Moving it to env did not unpublish it.
3. **DNO 15-way double-count** — with the API owner; reproduced on purpose.
4. **NG-zone grouping file is stale** — 32 GB regions in no zone grouping, 11 unresolved ids.
5. **`national` map level has no values path** — unreachable from the UI, so nothing is broken.
6. **Build script's `gsp_id → v1 name` source is a test fixture** — fragile, not wrong.
7. **Dead positional join in `sitesMap.tsx`** — only caller is commented out.

---

## Verified before handing over (2026-08-10)

| check | result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx jest` | 37 suites / 936 tests passed |
| `npx next build` | exit 0, bundle numbers as documented |
| every registry-declared `/geo/**` and `/data/**` URL over dev server | all 200 |

Not verified: anything requiring a live authenticated session against prod. That is this pass.
