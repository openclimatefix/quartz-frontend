import { theme } from "../../../tailwind.config";
import { ClockIcon } from "../../icons/icons";
import ForecastLabel from "../../national_forecast_labels";
import useGlobalState from "../../helpers/globalState";
import { useGenerationSources } from "../../../hooks/data/use-regions";
import { useFocusedCountry } from "../../../hooks/data";
import { getCountryConfig } from "../../../config/countries";
import { comparisonTitle } from "../../helpers/comparison";
const yellow = theme.extend.colors.solar.DEFAULT;

export const ForecastHeadlineFigure: React.FC<{
  tip: string;
  color?: string;
  time?: string;
  /**
   * The period the figure covers, as [start, end] — stacked rather than written `17:00–17:30`.
   *
   * A reading here is an average over a settlement period, the same as everywhere else in the
   * app, so the honest label is a range. Written inline it roughly doubles the width of a chip
   * that sits between two large figures in a row that is already tight at `lg`. Stacked, it
   * costs one short line of `text-2xs` and no width at all — the column is as wide as its
   * widest time either way, because the face is monospace and both times are five characters.
   *
   * Overrides `time` when present; `time` stays for the sites view, which has no period model.
   */
  times?: [string, string];
  unit?: string;
  gsp?: boolean;
  children?: React.ReactNode;
}> = ({ tip, color = yellow, time, times, unit = "GW", gsp = false, children }) => {
  // Slimmed: the ramp topped out at text-6xl, which made the two readings the loudest thing
  // on the page and pushed the chart itself down. One step down across the board.
  const textSizeClasses = `font-mono tracking-normal text-base md:text-lg leading-none text-${color} pr-0.5 ${
    gsp
      ? "dash:2xl:text-4xl dash:xl:text-3xl xl:text-2xl lg:text-xl"
      : "dash:3xl:text-4xl dash:xl:text-3xl lg:text-2xl"
  }`;
  return (
    <div
      data-test="pvlive-ocf-headline-figure"
      className="m-auto flex items-center justify-between gap-3 dash:py-0.5"
    >
      <div className="flex flex-1 self-center items-center justify-center">
        <div className={`flex items-center ${textSizeClasses}`}>
          {/* The unit rides on the figure's baseline, where a unit belongs. It used to share a
              grid gutter with a clock icon beside the times, which read row by row as
              "GW 10:00" — the unit paired with the end time instead of the number. */}
          <div className="flex items-baseline">
            <ForecastLabel
              position={"middle"}
              tip={
                <div className="min-w-36 whitespace-nowrap z-[100]">
                  <p>{tip}</p>
                </div>
              }
            >
              {children}
            </ForecastLabel>
            {times && (
              <span className="ml-1 font-sans text-2xs dash:text-sm dash:xl:text-base font-normal leading-none text-content">
                {unit}
              </span>
            )}
          </div>
          <div
            className={`${
              gsp ? "dash:3xl:gap-0" : "dash:3xl:gap-1"
            } flex flex-col dash:xl:gap-0 gap-0.5 items-start justify-center dash:xl:justify-between dash:justify-center pl-2`}
          >
            {times ? (
              /* The period's two ends, stacked, and nothing else: two 24-hour times read as a
                 span without a clock. Monospace and tabular, so they are the same width. */
              <div className="flex flex-col gap-0.5 font-mono tabular-nums text-2xs dash:text-sm dash:xl:text-base leading-none dash:leading-none text-content">
                <span>{times[0]}</span>
                {/* Same weight as the start. Dimming the end read as two different kinds of
                    value stacked, when they are two ends of one span. */}
                <span>{times[1]}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center text-content">
                  {time && (
                    <>
                      <ClockIcon className="h-3" />
                      <p className="font-mono tabular-nums text-2xs dash:text-sm dash:xl:text-base ml-0.5 dash:leading-none leading-none">
                        {time}
                      </p>
                    </>
                  )}
                </div>
                <span className="text-2xs dash:text-sm dash:xl:text-base text-content font-normal dash:leading-none leading-none">
                  {unit}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

type ForecastHeaderProps = {
  // Optional since Track P: the play button that used to guarantee a child here moved to the
  // footer, and the non-delta branch of `ForecastHeader` now renders no children at all.
  children?: React.ReactNode;
  forecastNextPV: string;
  forecastPV: string;
  actualPV: string;
  // selectedTimeOnly: string;
  pvTimeOnly: string;
  forecastNextTimeOnly: string;
  /** The periods those two instants name, stacked under the clock. See `ForecastHeadlineFigure`. */
  pvTimeRange?: [string, string];
  forecastNextTimeRange?: [string, string];
};

/**
 * A passive echo of the map's encoding, so the state is legible where the numbers are.
 *
 * Contract §5: comparison is authoritative on the map cluster, because it is the answer to
 * "what does the colour mean?" — it changes the map's whole encoding and the chart by one
 * series. It is named here anyway, and only named: reading a difference off a chart whose
 * header still says "National" is how you misread it.
 */
const ComparisonEcho: React.FC = () => {
  const [comparison] = useGlobalState("comparison");
  if (!comparison) return null;
  // An empty title means the preset has nothing worth echoing (Brad, 2026-08-17: the titles
  // "were taking up unnecessary space"). Render nothing rather than an empty span — the header
  // is a flex row, so a blank child still holds its gap open and the space is not reclaimed.
  const title = comparisonTitle(comparison);
  if (!title) return null;
  return (
    <span className="text-content text-xs md:text-sm dash:text-lg" data-test="comparison-echo">
      {title}
    </span>
  );
};

/**
 * The chart headers' shared row, national and regional alike: the title on the left, then every
 * figure (and the delta, when there is one) packed right on one centre line at one fixed gap.
 * The figures used to sit in a `flex-2 justify-between` box, so the space between them grew with
 * the card and each header padded its own wrappers differently.
 */
export const HEADER_ROW = "mx-1 mb-[5px] flex items-center gap-4";
export const HEADER_TITLE = "mr-auto flex min-w-0 items-center gap-2";
export const HEADER_FIGURES = "flex items-center gap-4 lg:gap-6";

const ForecastHeaderUI: React.FC<ForecastHeaderProps> = ({
  forecastNextPV,
  forecastPV,
  actualPV,
  children,
  // selectedTimeOnly,
  pvTimeOnly,
  forecastNextTimeOnly,
  pvTimeRange,
  forecastNextTimeRange
}) => {
  const focusedCountry = useFocusedCountry();
  // Falls back to the code rather than to "National": if the registry has no entry the code is
  // at least true, where a generic word would quietly identify nothing.
  const countryName = getCountryConfig(focusedCountry)?.displayName ?? focusedCountry;
  // The observed figure is whoever publishes this country's generation, not GB's PV Live.
  // GB's name is the fallback for the render before the manifest resolves.
  const generationSources = useGenerationSources(
    focusedCountry ? { country: focusedCountry, source: "solar" } : null
  );
  const observerLabel = generationSources.data?.[0]?.label ?? "PV Live";
  return (
    <div data-test="national-chart-header" className={HEADER_ROW}>
      {/* The title names the country outright. It used to read "National" beside a country
          picker — a word true of every country, so the picker was doing the identifying and
          the heading was decoration. The picker moved out; the name moved in. */}
      <div className={HEADER_TITLE}>
        <span className="text-base leading-tight text-content lg:text-lg dash:text-2xl">
          {countryName}
        </span>
        <ComparisonEcho />
      </div>
      <div className={HEADER_FIGURES}>
        <div>
          <ForecastHeadlineFigure
            tip={`${observerLabel} / OCF Forecast`}
            time={pvTimeOnly}
            times={pvTimeRange}
            color="solar"
          >
            <span className="text-solar-light">{actualPV}</span>
            <span className="text-content mx-1"> / </span>
            {forecastPV}
          </ForecastHeadlineFigure>
        </div>
        <div>
          <ForecastHeadlineFigure
            tip={`Next OCF Forecast`}
            time={forecastNextTimeOnly}
            times={forecastNextTimeRange}
            color="solar"
          >
            {forecastNextPV}
          </ForecastHeadlineFigure>
        </div>
        {children}
      </div>
    </div>
  );
};

export default ForecastHeaderUI;
