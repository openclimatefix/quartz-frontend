import { theme } from "../../../tailwind.config";
import { ClockIcon } from "../../icons/icons";
import ForecastLabel from "../../national_forecast_labels";
import useGlobalState from "../../helpers/globalState";
import { useFocusedCountry } from "../../../hooks/data";
import { getCountryConfig } from "../../../config/countries";
import { comparisonTitle } from "../../helpers/comparison";
const yellow = theme.extend.colors.solar.DEFAULT;

export const ForecastHeadlineFigure: React.FC<{
  tip: string;
  color?: string;
  time?: string;
  unit?: string;
  gsp?: boolean;
  children?: React.ReactNode;
}> = ({ tip, color = yellow, time, unit = "GW", gsp = false, children }) => {
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
      className="m-auto flex items-center justify-between gap-3 py-0.5 dash:py-1"
    >
      <div className="flex flex-1 self-center items-center justify-center">
        <div className={`flex items-center ${textSizeClasses}`}>
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
          <div
            className={`${
              gsp ? "dash:3xl:gap-0" : "dash:3xl:gap-1"
            } flex flex-col dash:xl:gap-0 gap-0.5 items-start justify-center dash:xl:justify-between dash:justify-center pl-2`}
          >
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
          </div>
        </div>
      </div>
    </div>
  );
};

export const ForecastWithActualPV: React.FC<{
  forecast: string;
  pv: string;
  time: string;
  tip: string;
  color?: string;
  sites?: boolean;
}> = ({ forecast, pv, time, tip, color = yellow, sites = false }) => {
  return (
    <div className="m-auto flex items-center justify-between gap-3 py-0.5 dash:py-1">
      <div className="dash:order-2">
        <ForecastLabel
          tip={
            <div className="w-36">
              <p>{tip}</p>
            </div>
          }
        >
          <div
            // className={`text-lg font-semibold leading-none text-center text-${color}`}
            className={`flex font-mono tabular-nums text-xl xl:text-2xl items-center dash:text-6xl leading-none mt-0.5 text-center text-${color}`}
            style={{ color: color }}
          >
            <span className="text-content-on-accent">{pv}</span>
            <span className="text-content px-0.5"> / </span>
            {forecast}
            <div className="flex flex-col items-start pl-2">
              <div className="flex items-center text-content">
                <ClockIcon />
                <p className="font-mono tabular-nums text-xs dash:text-xl ml-0.5">{time}</p>
              </div>
              <span className="text-xs dash:text-lg text-content font-normal">
                {sites ? "KW" : "GW"}
              </span>
            </div>
          </div>
        </ForecastLabel>
      </div>
    </div>
  );
};

export const NextForecast: React.FC<{ pv: string; tip: string; time: string; color?: string }> = ({
  pv,
  time,
  tip,
  color = yellow
}) => {
  return (
    <div
      data-test="forecast-label-tooltip"
      className="m-auto flex items-center justify-between gap-3 py-0.5 dash:py-1"
    >
      <ForecastLabel
        className="dash:order-2"
        tip={
          <div className="w-28">
            <p>{tip}</p>
          </div>
        }
      >
        <div>
          <p
            // className={`text-lg font-semibold leading-none text-center text-${color}`}
            className={`flex font-mono tabular-nums text-lg dash:text-6xl leading-none mt-0.5 text-center text-${color}`}
            style={{ color: color }}
          >
            {pv}
            <div className="flex flex-col  items-start pl-2">
              <div className="items-center text-content hidden dash:flex">
                <ClockIcon />
                <p className="font-mono tabular-nums dash:text-xl ml-0.5">{time}</p>
              </div>
              <span className="text-xs dash:text-lg text-content font-normal"> GW</span>
            </div>
          </p>
        </div>
      </ForecastLabel>
      <div className="flex items-center dash:hidden -ml-[2px]">
        <ClockIcon />
        <p className="font-mono tabular-nums text-xs dash:text-base ml-0.5">{time}</p>
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

const ForecastHeaderUI: React.FC<ForecastHeaderProps> = ({
  forecastNextPV,
  forecastPV,
  actualPV,
  children,
  // selectedTimeOnly,
  pvTimeOnly,
  forecastNextTimeOnly
}) => {
  const focusedCountry = useFocusedCountry();
  // Falls back to the code rather than to "National": if the registry has no entry the code is
  // at least true, where a generic word would quietly identify nothing.
  const countryName = getCountryConfig(focusedCountry)?.displayName ?? focusedCountry;
  return (
    <div
      data-test="national-chart-header"
      className="mx-2 mb-1.5 flex flex-initial content-between rounded-md"
    >
      {/* The title names the country outright. It used to read "National" beside a country
          picker — a word true of every country, so the picker was doing the identifying and
          the heading was decoration. The picker moved out; the name moved in. */}
      <div className="mx-auto my-0 ml-0 flex items-center gap-2">
        <span className="text-base leading-tight text-content lg:text-lg dash:text-2xl">
          {countryName}
        </span>
        <ComparisonEcho />
      </div>
      <div className="flex flex-2 justify-between">
        <div className="pr-3 lg:pr-4">
          <ForecastHeadlineFigure tip={`PV Live / OCF Forecast`} time={pvTimeOnly} color="solar">
            <span className="text-solar-light">{actualPV}</span>
            <span className="text-content mx-1"> / </span>
            {forecastPV}
          </ForecastHeadlineFigure>
        </div>
        <div>
          <ForecastHeadlineFigure
            tip={`Next OCF Forecast`}
            time={forecastNextTimeOnly}
            color="solar"
          >
            {forecastNextPV}
          </ForecastHeadlineFigure>
        </div>
      </div>
      <div className="inline-flex h-full">{children}</div>
    </div>
  );
};

export default ForecastHeaderUI;
