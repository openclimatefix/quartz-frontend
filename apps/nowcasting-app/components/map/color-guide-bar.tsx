import { useMemo } from "react";

import { DELTA_BUCKET, getDeltaBucketKeys } from "../../constant";
import { useCurrentAggregationLevel } from "../../hooks/data";
import { useEnabledCountries, useFocusedCountry } from "../../hooks/data/use-countries";
import { ComparisonSelection } from "../helpers/comparison";
import { NO_DATA_COLOR, NO_DATA_OPACITY } from "./feature-state";
import { ActiveUnit } from "./types";

type ColorGuideBarProps = { comparison: ComparisonSelection; unit: ActiveUnit };

/**
 * What the map's fill means, for whichever encoding "Colour by" currently selects.
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
 * - It would usually buy nothing: the percentage bands never read the level at all (see
 *   below), so two countries showing "%" would render the *same* row twice. The bands only
 *   diverge for MW/capacity, and only when the enabled countries sit at different grouping
 *   tiers — exactly the case `feature-state.ts`'s per-feature `grouped` flag exists for.
 *
 * So: one row, explicitly attributed, rather than a second row that usually agrees with the
 * first and spends §6a's tight budget doing it. A user who needs the other enabled country's
 * bands gets them the same way they already get its headline figure and level — by focusing
 * it, which a click on any of its regions does.
 *
 * The diverging (delta) buckets are a fixed MW scale from `constant.ts`, not derived from the
 * aggregation level, so they do not vary by country or level and never needed this label.
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
          country={enabledCountries.length > 1 ? focusedCountry : undefined}
        />
      )}
    </div>
  );
};

const SequentialBands: React.FC<{
  unit: ActiveUnit;
  currentLevel: ReturnType<typeof useCurrentAggregationLevel>;
  /** Set only when more than one country is enabled, to label whose bands these are. */
  country?: string;
}> = ({ unit, currentLevel, country }) => {
  const values = useMemo(() => {
    if (unit === ActiveUnit.percentage) {
      return [
        { value: "0-10", opacity: 3, textColor: "ocf-gray-300" },
        { value: "10-20", opacity: 20, textColor: "ocf-gray-300" },
        { value: "20-35", opacity: 40, textColor: "ocf-gray-300" },
        { value: "35-50", opacity: 60, textColor: "black" },
        { value: "50-70", opacity: 80, textColor: "black" },
        { value: "70+", opacity: 100, textColor: "black" }
      ];
    }
    // These MW/capacity bands are calibrated to GB's actual scales — a single GSP tops out
    // around 450 MW, a DNO/zone grouping (dozens of GSPs) around 4.5 GW — not a generic
    // per-country rule, so the check is on the region type's identity (the one place in this
    // file that legitimately is), not on `derived`.
    if (currentLevel?.regionType === "gsp") {
      if (unit === ActiveUnit.MW) {
        return [
          { value: "0-50", opacity: 3, textColor: "ocf-gray-300" },
          { value: "50-150", opacity: 20, textColor: "ocf-gray-300" },
          { value: "150-250", opacity: 40, textColor: "ocf-gray-300" },
          { value: "250-350", opacity: 60, textColor: "black" },
          { value: "350-450", opacity: 80, textColor: "black" },
          { value: "450+", opacity: 100, textColor: "black" }
        ];
      } else if (unit === ActiveUnit.capacity) {
        return [
          { value: "0-50", opacity: 3, textColor: "ocf-gray-300" },
          { value: "50-150", opacity: 20, textColor: "ocf-gray-300" },
          { value: "150-250", opacity: 40, textColor: "ocf-gray-300" },
          { value: "250-350", opacity: 60, textColor: "black" },
          { value: "350-450", opacity: 80, textColor: "black" },
          { value: "450+", opacity: 100, textColor: "black" }
        ];
      }
    } else if (currentLevel?.derived) {
      if (unit === ActiveUnit.MW) {
        return [
          { value: "0-500", opacity: 3, textColor: "ocf-gray-300" },
          { value: "500-1.5k", opacity: 20, textColor: "ocf-gray-300" },
          { value: "1.5k-2.5k", opacity: 40, textColor: "ocf-gray-300" },
          { value: "2.5k-3.5k", opacity: 60, textColor: "black" },
          { value: "3.5k-4.5k", opacity: 80, textColor: "black" },
          { value: "4.5k+", opacity: 100, textColor: "black" }
        ];
      } else if (unit === ActiveUnit.capacity) {
        return [
          { value: "0-500", opacity: 3, textColor: "ocf-gray-300" },
          { value: "500-1.5k", opacity: 20, textColor: "ocf-gray-300" },
          { value: "1.5k-2.5k", opacity: 40, textColor: "ocf-gray-300" },
          { value: "2.5k-3.5k", opacity: 60, textColor: "black" },
          { value: "3.5k-4.5k", opacity: 80, textColor: "black" },
          { value: "4.5k+", opacity: 100, textColor: "black" }
        ];
      }
    }
  }, [unit, currentLevel]);
  let unitText = unit === ActiveUnit.MW ? "MW" : "%";
  if (unit === ActiveUnit.capacity) {
    unitText = "MW";
  }
  return (
    // Positioning only: this used to anchor itself to the map's bottom-left corner
    // (`absolute bottom-12 left-0 ml-12 z-20`), which is where the floating chart now sits. It
    // lays out in normal flow inside the map control dock instead. Bands and colours untouched.
    <div className="flex flex-col bg-mapbox-black-700">
      {country && (
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
        {/*
          The map draws three different things and the legend has to name them. A region that
          reported nothing is grey; a region that has not published this slot yet is left
          unfilled (border only); a region generating 0 MW is a real value and gets the first
          band above, which is why that band is 3% opacity rather than invisible.
        */}
        <div
          className="whitespace-nowrap rounded border border-ocf-black-600 px-3 py-[1px] text-white dash:px-4 dash:py-[2px]"
          style={{ backgroundColor: NO_DATA_COLOR, opacity: NO_DATA_OPACITY + 0.4 }}
          title="Reported no value for this time. Regions still to publish are left unfilled."
        >
          no data
        </div>
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
