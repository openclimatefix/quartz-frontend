import { useMemo } from "react";

import { DELTA_BUCKET, getDeltaBucketKeys } from "../../constant";
import { useCurrentAggregationLevel } from "../../hooks/data";
import { useEnabledCountries, useFocusedCountry } from "../../hooks/data/use-countries";
import { ComparisonSelection } from "../helpers/comparison";
import {
  BAND_OPACITIES,
  bandLabels,
  mapBandsFor,
  NORMALIZED_TICKS,
  normalizedTickLabels,
  PERCENT_RAMP_TOP,
  ZERO_OPACITY
} from "./feature-state";
import { ActiveUnit } from "./types";

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
        <DeltaBands />
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
        className="relative h-4 w-full rounded border border-ocf-black-600 dash:h-6"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255,208,83,${ZERO_OPACITY}), rgba(255,208,83,1))`
        }}
      >
        {NORMALIZED_TICKS.map((fraction) => (
          <span
            key={fraction}
            className="absolute top-0 bottom-0 w-px bg-white/50"
            style={{ left: `${Math.min(100, (fraction / PERCENT_RAMP_TOP) * 100)}%` }}
          />
        ))}
      </div>
      <div className="relative mt-0.5 h-3 text-2xs text-ocf-gray-600 dash:h-4 dash:text-xs">
        {NORMALIZED_TICKS.map((fraction, index) => (
          <span
            key={fraction}
            className="absolute -translate-x-1/2 whitespace-nowrap tabular-nums"
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

/** The six pills, from a label per band. Opacity and text colour are fixed per position. */
const bandPills = (labels: string[]) =>
  labels.map((value, index) => ({
    value,
    // The same array the paint expression steps to, as a Tailwind opacity suffix. 0.03 * 100
    // is 3.0000000000000004 in floating point and `bg-ocf-yellow/3.0000000000000004` is not a
    // class, hence the round.
    opacity: Math.round(BAND_OPACITIES[index] * 100),
    // The top three bands are dark enough to need dark text on them.
    textColor: index < 3 ? "ocf-gray-300" : "black"
  }));

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
    const thresholds = mapBandsFor(country, currentLevel.derived);
    if (!thresholds) return undefined;
    return bandPills(bandLabels(thresholds));
  }, [unit, currentLevel, country]);
  let unitText = unit === ActiveUnit.MW ? "MW" : "%";
  if (unit === ActiveUnit.capacity) {
    unitText = "MW";
  }
  return (
    // Positioning only: this used to anchor itself to the map's bottom-left corner
    // (`absolute bottom-12 left-0 ml-12 z-20`), which is where the floating chart now sits. It
    // lays out in normal flow inside the map control dock instead. Bands and colours untouched.
    <div className="flex flex-col bg-mapbox-black-700">
      {attributed && (
        <span className="pb-0.5 text-2xs font-semibold uppercase tracking-wider text-ocf-gray-600">
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
      <div className="flex flex-wrap gap-1 text-xs h-full text-ocf-black-600 font-bold relative items-end md:text-sm dash:text-xl dash:tracking-wide">
        {unit === ActiveUnit.percentage && <PercentRamp />}
        {values?.map((value, index) => (
          <div
            key={value.value}
            className={`rounded border border-ocf-black-600 px-3 py-[1px] dash:px-4 dash:py-[2px] bg-ocf-yellow/${value.opacity} whitespace-nowrap text-${value.textColor}`}
          >
            {value.value}
            {index === 0 && (
              <span
                className={`font-normal ${
                  value.textColor === "black" ? "text-ocf-black-500" : "text-ocf-gray-600"
                } text-xs ml-1`}
              >
                {unitText}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const DeltaBands: React.FC = () => {
  const deltaKeys = getDeltaBucketKeys();
  return (
    <div className="flex bg-mapbox-black-700">
      <div className="flex flex-wrap gap-1 h-full font-bold relative items-end text-sm">
        {deltaKeys.map((value) => {
          let background = "";
          let opacity = 0;
          let textColor = "";
          let text = 0;
          switch (value) {
            case deltaKeys[0]:
              background = "bg-ocf-delta-100";
              (opacity = 3), (textColor = "text-black"), (text = DELTA_BUCKET.NEG4);
              break;
            case deltaKeys[1]:
              (background = "bg-ocf-delta-200"), (opacity = 20), (textColor = "text-black");
              text = DELTA_BUCKET.NEG3;
              break;
            case deltaKeys[2]:
              (background = "bg-ocf-delta-300"), (opacity = 40), (textColor = "text-black");
              text = DELTA_BUCKET.NEG2;
              break;
            case deltaKeys[3]:
              (background = "bg-ocf-delta-400"), (opacity = 60), (textColor = "text-ocf-gray-300");
              text = DELTA_BUCKET.NEG1;
              break;
            case deltaKeys[4]:
              (background = "bg-ocf-delta-500"), (opacity = 80), (textColor = "text-ocf-gray-300");
              text = DELTA_BUCKET.ZERO;
              break;
            case deltaKeys[5]:
              (background = "bg-ocf-delta-600"), (opacity = 100), (textColor = "text-ocf-gray-300");
              text = DELTA_BUCKET.POS1;
              break;
            case deltaKeys[6]:
              (background = "bg-ocf-delta-700"), (opacity = 100), (textColor = "text-black");
              text = DELTA_BUCKET.POS2;
              break;
            case deltaKeys[7]:
              (background = "bg-ocf-delta-800"), (opacity = 100), (textColor = "text-black");
              text = DELTA_BUCKET.POS3;
              break;
            case deltaKeys[8]:
              (background = "bg-ocf-delta-900"), (opacity = 100), (textColor = "text-black");
              text = DELTA_BUCKET.POS4;
              break;
          }
          return (
            <div
              key={value}
              className={`rounded border border-ocf-black-100 px-3 py-[1px] ${background} text-xs md:text-sm dash:text-xl dash:tracking-wide whitespace-nowrap ${textColor}`}
            >
              {text > 0 ? "+" : ""}
              {text}
              <span className="text-xs font-normal">{text === DELTA_BUCKET.POS4 && " MW"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ColorGuideBar;
