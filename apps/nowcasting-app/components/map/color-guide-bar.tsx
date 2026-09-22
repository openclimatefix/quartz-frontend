import { useMemo } from "react";

import { DELTA_BUCKET, DELTA_BUCKET_OPACITIES, deltaBucketEdge } from "../../constant";
import { useCurrentAggregationLevel } from "../../hooks/data";
import { useEnabledCountries, useFocusedCountry } from "../../hooks/data/use-countries";
import { ComparisonSelection } from "../helpers/comparison";
import {
  BAND_OPACITIES,
  bandLabels,
  capacityTopFor,
  mapBandsFor,
  NORMALIZED_TICKS,
  normalizedTickLabels,
  PERCENT_RAMP_TOP,
  ZERO_OPACITY
} from "./feature-state";
import { useMapObserver } from "./map-observer";
import { ActiveUnit } from "./types";
import { theme } from "../../tailwind.config";
import { displayDecimalsFor, displayUnitFor, toDisplayPower } from "../../lib/domain/power-unit";

type ColorGuideBarProps = { comparison: ComparisonSelection; unit: ActiveUnit };

/**
 * What the map's fill means, for whichever encoding "Map shows" currently selects.
 *
 * Phase 6 §5: `color-guide-bar` and `delta-color-guide-bar` were two components swapped by a
 * ternary on `comparison`, below the segmented control that sets it. They are now one control
 * that reads the same `comparison` value and switches internally — selecting the encoding and
 * explaining it are one control rather than two things that happen to sit next to each other.
 * Neither branch's bands, colours or copy changed; only the file and the export did.
 *
 * ## The multi-country legend question (handed to this track by Phase 6 Track F)
 *
 * The map draws every *enabled* country at once, each at its own aggregation level — GB might
 * be on its DNO rollup while NL is on provinces, in the same frame. This legend (like
 * `useCurrentAggregationLevel` itself) still explains only the *focused* country's bands. A
 * single legend that silently describes only one of several countries on screen is a way to
 * misread the map, so with more than one country enabled it now says so explicitly — the
 * bands are labelled with the country they belong to ("GB bands") rather than presented as
 * universal.
 *
 * A band row **per enabled country** was considered and rejected, for two reasons:
 *
 * - The enabled set is variable-length, and `useCurrentAggregationLevel` is a hook — calling
 *   it once per enabled country needs the same child-component fan-out
 *   `use-enabled-country-map-data.tsx` used for the same reason. That is a lot of machinery
 *   for a legend.
 * - It would usually buy nothing: the percentage bands never read the level or the country at
 *   all (see below), so two countries showing "%" would render the *same* row twice. The bands
 *   only diverge for MW/capacity — where, since this follow-up, they diverge by *country* as
 *   well as by grouping tier, since each country's thresholds are its own registry entry's.
 *   That is exactly the case `feature-state.ts`'s per-feature country/`grouped` selection
 *   exists for, and it is also why the attribution line below matters more than it did: with
 *   GB and NL enabled, "GB bands" now means numbers NL's polygons are genuinely not on.
 *
 * So: one row, explicitly attributed, rather than a second row that usually agrees with the
 * first and spends §6a's tight budget doing it. A user who needs the other enabled country's
 * bands gets them the same way they already get its headline figure and level — by focusing
 * it, which a click on any of its regions does.
 *
 * The diverging (delta) buckets are a fixed MW scale from `constant.ts`, not derived from the
 * aggregation level, so they do not vary by country or level and never needed this label.
 *
 * ## Why there is no "no data" key here (2026-08-15)
 *
 * The legend explains the **value scale** and nothing else. The map draws three states — a value,
 * a region that reported nothing, and a region that has not published this slot — and the other
 * two are named on hover instead: `pvLatestMap.tsx`'s popup reads "no data" or "awaiting" in
 * place of the figure, per region and per instant, which is more use than a swatch that can only
 * say the category exists.
 *
 * This used to be a seventh pill on the end of the band row, which made a non-quantity read as a
 * step on the scale. Measured across two full days of real data — 24,529 region-slots, GB and NL
 * — **no region reported nothing even once**. Permanent legend billing for a state that rare is
 * the same mistake as painting it heavier than a real zero: it is an anomaly, and the design
 * should treat it as one. If it ever becomes common enough to confuse someone, the upgrade is to
 * render a key *conditionally*, when a region in frame is actually in that state — by which
 * point there would be evidence it happens.
 */
const ColorGuideBar: React.FC<ColorGuideBarProps> = ({ comparison, unit }) => {
  const focusedCountry = useFocusedCountry();
  const enabledCountries = useEnabledCountries();
  const currentLevel = useCurrentAggregationLevel();

  return (
    <div>
      {comparison ? (
        <DeltaBands country={focusedCountry} unit={unit} />
      ) : (
        <SequentialBands
          unit={unit}
          currentLevel={currentLevel}
          country={focusedCountry}
          attributed={enabledCountries.length > 1}
        />
      )}
    </div>
  );
};

/**
 * The percentage legend: the ramp itself, with the reference values ticked along it.
 *
 * Not pills, because percentage is no longer banded. The gradient runs the same stops the paint
 * expression interpolates between — a real zero at 3% opacity, full at 70% of capacity — so the
 * legend and the map are the same scale rather than two descriptions of one. Ticks are placed by
 * their own value, so they stay honest if the ramp's top ever moves.
 */
const PercentRamp: React.FC = () => {
  const ticks = normalizedTickLabels();
  return (
    <div className="flex w-full min-w-[10rem] max-w-[16rem] flex-col dash:max-w-[24rem]">
      <div
        className="relative h-4 w-full rounded border border-content-on-accent bg-map-land dash:h-6"
        style={{
          backgroundImage: `linear-gradient(to right, ${solarAt(ZERO_OPACITY)}, ${solarAt(1)})`
        }}
      >
        {NORMALIZED_TICKS.map((fraction) => (
          <span
            key={fraction}
            className="absolute top-0 bottom-0 w-px bg-content/50"
            style={{ left: `${Math.min(100, (fraction / PERCENT_RAMP_TOP) * 100)}%` }}
          />
        ))}
      </div>
      <div className="relative mt-0.5 h-3 font-mono text-2xs text-content-secondary dash:h-4 dash:text-xs">
        {NORMALIZED_TICKS.map((fraction, index) => (
          <span
            key={fraction}
            // Centred on its own tick, except the last, which is held flush to the right edge:
            // centred, half of "80%+" hangs off the panel.
            className={`absolute whitespace-nowrap tabular-nums ${
              index === NORMALIZED_TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
            }`}
            style={{ left: `${Math.min(100, (fraction / PERCENT_RAMP_TOP) * 100)}%` }}
          >
            {ticks[index]}
            {index === ticks.length - 1 && "%+"}
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * The megawatt legend: the same ramp as `PercentRamp`, ticked at the country's own thresholds.
 *
 * The pills went when the map's megawatt paint went continuous — six swatches describing an
 * unbroken ramp would be a second, coarser account of the same scale. The numbers are the
 * unchanged `mapBands` thresholds, in the country's display unit; the last is where the ramp
 * saturates, hence its "+".
 */
/**
 * Round numbers to tick a ramp at, given where it saturates.
 *
 * The thresholds themselves were the obvious choice and read badly: they are derived from a
 * country's largest region, so DE's come out 1.5 / 4.5 / 7.5 / 10.5 against a 13.5 top, and at
 * panel width the last two collide. A scale is easier to read at round numbers with uneven
 * gaps than at exact ones that overlap — the ticks annotate the ramp, they do not define it.
 *
 * Roughly four ticks, on a 1/2/5 step (so 2, 5, 10, 20, 50 … and 0.5 where the top is small),
 * dropping any that crowds the saturation label at the right-hand end.
 */
const rampTickValues = (top: number): number[] => {
  const ticksFor = (step: number) => {
    const values: number[] = [];
    for (let value = step; value < top; value += step) {
      // The saturation label ("3.6GW+") is held flush right and is wide, so the last fifth of
      // the ramp is its own — a tick at 3 against a top of 3.6 ran into it and read "33.6GW+".
      if ((top - value) / top < 0.2) break;
      values.push(Number(value.toFixed(2)));
    }
    return values;
  };

  // 1/2/5 across every magnitude the ramp could want. The COARSEST step that still gives two
  // ticks wins: finer steps are what push a ramp into halves and quarters, and a scale is read
  // more easily at two round numbers than at five awkward ones.
  const magnitudes = [-2, -1, 0, 1, 2, 3, 4].map((power) => Math.pow(10, power));
  const steps = magnitudes.flatMap((magnitude) => [1, 2, 5].map((n) => n * magnitude));
  const usable = steps.filter((candidate) => ticksFor(candidate).length >= 2);
  const step = usable[usable.length - 1];
  return step === undefined ? [] : ticksFor(step);
};

const ValueRamp: React.FC<{ thresholds: number[]; unitText: string }> = ({
  thresholds,
  unitText
}) => {
  const top = thresholds[thresholds.length - 1];
  const ticks = rampTickValues(top);
  return (
    <div className="flex w-full min-w-[10rem] max-w-[16rem] flex-col dash:max-w-[24rem]">
      <div
        className="relative h-4 w-full rounded border border-content-on-accent bg-map-land dash:h-6"
        style={{
          backgroundImage: `linear-gradient(to right, ${solarAt(ZERO_OPACITY)}, ${solarAt(1)})`
        }}
      >
        {ticks.map((value) => (
          <span
            key={value}
            className="absolute top-0 bottom-0 w-px bg-content/50"
            style={{ left: `${Math.min(100, (value / top) * 100)}%` }}
          />
        ))}
      </div>
      <div className="relative mt-0.5 h-3 font-mono text-2xs text-content-secondary dash:h-4 dash:text-xs">
        {ticks.map((value) => (
          <span
            key={value}
            className="absolute -translate-x-1/2 whitespace-nowrap tabular-nums"
            style={{ left: `${(value / top) * 100}%` }}
          >
            {value}
          </span>
        ))}
        {/* Where the ramp saturates, held flush to the right edge and carrying the unit. */}
        <span className="absolute right-0 whitespace-nowrap tabular-nums">
          {top}
          {unitText}+
        </span>
      </div>
    </div>
  );
};

/**
 * The data yellow at a given opacity, as a CSS colour.
 *
 * Read from the Tailwind theme — the same `theme.extend.colors.solar.DEFAULT` the map's paint
 * expression reads (`feature-state.ts`) — so the legend cannot describe a colour the map does
 * not paint. `PercentRamp` used to write its gradient as a literal `rgba(255,208,83, …)`, which
 * was not `solar` at all (`#FFD053` against `#FFD480`: 45 out in blue, visibly more orange), so
 * the percentage legend and the map were genuinely painting two different yellows.
 */
const SOLAR_RGB = (() => {
  const hex = theme.extend.colors.solar.DEFAULT.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
})();

const solarAt = (alpha: number) => `rgba(${SOLAR_RGB},${alpha})`;

/**
 * A flat fill of `solarAt(alpha)`, as a `background-image`.
 *
 * The ground underneath is `bg-map-land`, so the pill composites the same yellow over the same
 * colour the map does and the two agree at every band rather than only at the top one. A
 * two-stop gradient because `background-image` layers over `background-color` where a second
 * `background-color` cannot.
 */
const bandFill = (alpha: number) => `linear-gradient(${solarAt(alpha)},${solarAt(alpha)})`;

const SequentialBands: React.FC<{
  unit: ActiveUnit;
  currentLevel: ReturnType<typeof useCurrentAggregationLevel>;
  /** The focused country — whose bands these are, and where the numbers come from. */
  country: string;
  /** Label the row with the country, done when more than one country is enabled. */
  attributed: boolean;
}> = ({ unit, currentLevel, country, attributed }) => {
  const values = useMemo(() => {
    // Percentage is drawn as a continuous ramp, so it has no pills to build — see
    // `PercentRamp` below and the note on `NORMALIZED_TICKS` in `feature-state.ts`.
    if (unit === ActiveUnit.percentage) return undefined;
    // MW and capacity are absolute megawatts, so they need the focused country's scale. Both
    // read the same thresholds, as they always have.
    //
    // These used to be four hardcoded lists in this file, branching on
    // `currentLevel.regionType === "gsp"` — GB's region type by name, so NL's provinces
    // matched neither branch and drew no bands at all while the map painted them on GB's
    // scale. The numbers now come from `config/countries.ts` via the same lookup
    // `fillOpacityExpression` uses, and the labels are formatted from that same array, so the
    // legend cannot describe a band the map does not draw.
    //
    // National level draws one polygon per country and has no useful band scale; it showed
    // nothing before and shows nothing now.
    if (!currentLevel || currentLevel.level <= 0) return undefined;
    // Capacity has its own saturation point (`capacityTop`), because installed capacity runs
    // several times the output a region reaches — see `MapBandsConfig`. The ramp needs only
    // where it ends, so capacity mode hands over a single value.
    const capacityTop = capacityTopFor(country, currentLevel.derived);
    const thresholds =
      unit === ActiveUnit.capacity
        ? capacityTop === undefined
          ? undefined
          : [capacityTop]
        : mapBandsFor(country, currentLevel.derived);
    if (!thresholds) return undefined;
    // The thresholds themselves stay MW — they are the map's own paint expression's numbers,
    // read from the same lookup, and nothing here is allowed to drift from that. This is a
    // display-only copy, rounded to the country's unit purely for the label under each pill.
    const displayUnit = displayUnitFor(country);
    const displayThresholds = thresholds.map((value) =>
      Number(toDisplayPower(value, displayUnit).toFixed(displayDecimalsFor(displayUnit)))
    );
    return displayThresholds;
  }, [unit, currentLevel, country]);
  const displayUnit = displayUnitFor(country);
  let unitText = unit === ActiveUnit.MW ? displayUnit : "%";
  if (unit === ActiveUnit.capacity) {
    unitText = displayUnit;
  }
  return (
    // Positioning only: this used to anchor itself to the map's bottom-left corner
    // (`absolute bottom-12 left-0 ml-12 z-20`), which is where the floating chart now sits. It
    // lays out in normal flow inside the map control dock instead. Bands and colours untouched.
    <div className="flex flex-col">
      {attributed && (
        <span className="pb-0.5 text-2xs font-semibold uppercase tracking-wider text-content-secondary">
          {country} bands
        </span>
      )}
      {/*
        Was one row in an `overflow-x-auto` sized to `MAP_CONTROL_WIDTH_PX` (260px) — six bands
        plus the "no data" pill do not fit that width in one line, so the last two scrolled out
        of view (§6a: "near its limit"). Wrapping is the fix rather than shaving pixels: each
        pill is now self-contained (its own border on every side, not a chain of `border-l`s
        that assumed a single row) so it reads correctly whichever row it lands on, with or
        without the "GB bands" attribution line above it, and at any wrap count — this also
        covers `DeltaBands` below, whose nine buckets wrap the same way.
      */}
      <div className="flex flex-wrap gap-1 font-mono tabular-nums text-xs h-full text-content-on-accent font-bold relative items-end md:text-sm dash:text-xl dash:tracking-wide">
        {unit === ActiveUnit.percentage && <PercentRamp />}
        {values && <ValueRamp thresholds={values} unitText={unitText} />}
      </div>
    </div>
  );
};

/**
 * The nine delta buckets, in scale order: the Tailwind background and text colour for each.
 *
 * Was a nine-arm `switch` inside the render, matching each `getDeltaBucketKeys()` entry against
 * `deltaKeys[n]` to recover the index it already had. Same colours, same order — the shape is
 * now a table because the row's sizing (below) has to reason about how many cells there are.
 * The `opacity` each arm also computed was dead: the backgrounds are solid `ocf-delta` steps,
 * not opacity ramps like the sequential pills, and nothing ever read it.
 */
const DELTA_STEPS: { value: DELTA_BUCKET; background: string; text: string }[] = [
  { value: DELTA_BUCKET.NEG4, background: "bg-ocf-delta-100", text: "text-content-on-accent" },
  { value: DELTA_BUCKET.NEG3, background: "bg-ocf-delta-200", text: "text-content-on-accent" },
  { value: DELTA_BUCKET.NEG2, background: "bg-ocf-delta-300", text: "text-content-on-accent" },
  { value: DELTA_BUCKET.NEG1, background: "bg-ocf-delta-400", text: "text-content" },
  { value: DELTA_BUCKET.ZERO, background: "bg-ocf-delta-500", text: "text-content" },
  { value: DELTA_BUCKET.POS1, background: "bg-ocf-delta-600", text: "text-content" },
  { value: DELTA_BUCKET.POS2, background: "bg-ocf-delta-700", text: "text-content-on-accent" },
  { value: DELTA_BUCKET.POS3, background: "bg-ocf-delta-800", text: "text-content-on-accent" },
  { value: DELTA_BUCKET.POS4, background: "bg-ocf-delta-900", text: "text-content-on-accent" }
];

/**
 * The same nine cells labelled with `DELTA_PERCENTAGE_EDGES` instead of megawatts.
 *
 * Built from the edges rather than written out, so the legend cannot drift from the scale
 * `getDeltaBucketNormalized` actually steps on. The colours are positional and shared with the
 * megawatt row above — only the numbers change with the unit, because only the numbers do.
 */
/**
 * The nine legend cells' opacities, mirroring `DELTA_BUCKET_OPACITIES` outward from the middle.
 *
 * The neutral cell is `0.45` rather than the map's `0` — on the map "no meaningful difference"
 * is correctly drawn as nothing, but a legend cell that renders as nothing is not a legend, it
 * is a gap. It stays the faintest cell in the row, which is the property that matters.
 */
const DELTA_CELL_OPACITIES = [
  ...[...DELTA_BUCKET_OPACITIES].reverse(),
  0.45,
  ...DELTA_BUCKET_OPACITIES
];

const DELTA_PERCENTAGE_STEPS = DELTA_STEPS.map((step) => ({
  ...step,
  value: deltaBucketEdge(step.value, true)
}));

/**
 * The diverging legend: nine buckets on one row, and the observer they are measured against.
 *
 * ## Why it says what it is measured against
 *
 * The whole fill on the delta map is `forecast − actual`, and "actual" is one specific
 * observed stream — for GB, PV Live *Estimated*, never *Updated*, because the values pipeline
 * takes a single observer (see `map-observer.ts`). Nothing on screen said so, which let a
 * legend that carefully explains its colours sit above a map whose quantity was unnamed. The
 * sequential legend already carries a conditional attribution line for the same class of
 * problem — `{country} bands`, when more than one country is enabled — and this is that
 * argument on a different axis, so it reuses the styling exactly.
 *
 * It is unconditional here, where the country line is conditional, because the ambiguity is
 * not situational: there is no configuration in which "delta" alone tells you the B side.
 *
 * ## Why one row
 *
 * Brad, 2026-08-16: get them on one line with smaller type and padding, and fall back to a
 * continuous ramp only if that does not fit. It fits, in the dock's ~244px usable width
 * (`MAP_CONTROL_WIDTH_PX` 260, less the panel's `p-2`), where the previous `text-sm`/`px-3`
 * pills needed roughly three wrapped rows.
 *
 * Three things paid for the fit, and all three are also improvements. The constraint they were
 * all paying is that these are equal `flex-1` cells, so the **widest** cell sets the width of
 * every cell and anything shaved off the widest is multiplied by nine:
 *
 * - **The signs moved to the ends of the row.** See the note on the glyphs below — the single
 *   biggest win, and the reason the cells have padding at all.
 * - **The unit moved to the caption.** It was a `" MW"` span inside the `+100` cell, which
 *   made the widest cell wider still and put the row's unit inside one arbitrary bucket.
 * - **The per-cell border went.** The sequential pills need theirs because they are one hue at
 *   six opacities — without a border, adjacent bands merge. The delta steps are nine distinct
 *   hues, so the borders were separating things that were already separate, and losing them
 *   lets the row read closer to the continuous scale it represents.
 *
 * Kept discrete rather than ramped, deliberately: the paint expression *is* a `step` over nine
 * buckets, so a smooth gradient would describe a map that does not exist. (It would also
 * expose that `ocf-delta` is not monotonic in lightness — 800 is brighter than 900 — which is
 * Delta v2's palette work, not this change's.)
 */
const DeltaBands: React.FC<{ country: string; unit: ActiveUnit }> = ({ country, unit }) => {
  // The manifest slice the map's own values pipeline reads, so the legend cannot name a
  // stream the fill was not computed from. No extra request: see `useMapObserver`.
  const { label } = useMapObserver(country ? { country, source: "solar" } : null);
  // Capacity cannot reach here — `setComparison` moves off it and the toggle disables it — so
  // the MW branch is a defensive default rather than a statement about what capacity means.
  const asPercentage = unit === ActiveUnit.percentage;
  const unitText = asPercentage ? "% of capacity" : "MW";
  // The edges the paint expression actually steps on, in the unit being shown, so the legend
  // and the fill cannot describe different scales.
  const steps = asPercentage ? DELTA_PERCENTAGE_STEPS : DELTA_STEPS;
  return (
    <div className="flex flex-col bg-surface-raised">
      <span className="pb-0.5 text-2xs font-semibold uppercase tracking-wider text-content-secondary">
        {/*
          The subtraction, not "vs". `delta` is `generationMw - forecastMw`, so a `+` means the
          actual came in *above* the forecast — and "MW vs PV Live Estimated" does not say that,
          while the ramp (cold on the left, hot on the right) cannot say it either. Writing the
          operands in order is the only form that fixes the direction on screen.

          Until the manifest resolves, say the unit and no more rather than guessing a stream —
          an unnamed delta is exactly what this replaced.
        */}
        {`${label} − forecast`}
      </span>
      {/*
        One `role="img"` with the whole scale in its label, rather than nine cells a screen
        reader would read as bare numbers. It has to be here rather than on the cells: the
        magnitudes below are deliberately unsigned, so read out individually they would say
        "100, 75, 50 … 100" with the direction — the entire point of a diverging scale —
        missing.
      */}
      <div
        role="img"
        aria-label={`Delta colour scale, minus ${Math.abs(steps[0].value)} to plus ${
          steps[steps.length - 1].value
        } ${unitText}${
          label ? `, ${label} minus forecast; positive means actual above forecast` : ""
        }`}
        className="flex items-center gap-1 font-mono text-2xs font-bold text-content-secondary dash:text-base"
      >
        {/*
          The sign, twice, instead of nine times. With equal `flex-1` cells the *widest* cell
          sets the width of every cell, so `+100` at ~23.5px in a ~25px cell was what made the
          row cramped — and per-cell signs are redundant anyway on a scale that is symmetric
          about a labelled `0` and already runs cold-to-hot left-to-right. Hoisting them to the
          ends is the one piece of information the row genuinely needs, stated once at each end.

          The two glyphs cost ~22px including their gaps and give back ~26px across the cells,
          so the row is marginally narrower *and* each cell holds a 3-character number in ~23px
          — enough that the horizontal padding, dropped to make `+100` fit, comes back.

          U+2212 MINUS, not a hyphen: it is the same width and weight as the `+` opposite it,
          where a hyphen sits high and short and makes the two ends look mismatched.
        */}
        <span aria-hidden>−</span>
        {/*
          `flex-wrap` matters only in `dash:`. The dock is a fixed `MAP_CONTROL_WIDTH_PX` in
          every mode, so the dashboard's larger type cannot fit nine cells across it however
          they are sized; there `flex-none` returns them to content width and lets them wrap as
          they did before. One row is a normal-size claim, not a universal one — better than
          holding the line by leaving a wall display at 10px.
        */}
        <div className="flex flex-1 flex-wrap gap-[2px] items-end tabular-nums">
          {steps.map(({ value, background, text }, index) => (
            <div
              key={value}
              className={`flex-1 rounded-sm px-[2px] py-[1px] text-center dash:flex-none dash:px-2 dash:py-[2px] whitespace-nowrap ${background} ${text}`}
              /*
                The same magnitude ramp the fill draws (`deltaFillOpacityExpression`), so the
                legend keeps describing the map now that strength carries meaning as well as
                hue. Inline rather than a `bg-…/${n}` utility because these are computed and
                Tailwind cannot see them to generate the class.

                Position, not value: the row is symmetric, so cell `index` maps onto the
                opacity ladder from the outside in and back out. The neutral cell keeps a floor
                of its own — it paints transparent on the map, but a legend cell has to be
                visible to be read as the "no meaningful difference" step.
              */
              style={{ opacity: DELTA_CELL_OPACITIES[index] }}
            >
              {/* Magnitude only — the sign is on the row, and `0` has neither. */}
              {Math.abs(value)}
            </div>
          ))}
        </div>
        <span aria-hidden>+</span>
      </div>
    </div>
  );
};

export default ColorGuideBar;
