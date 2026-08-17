import { theme } from "../../../tailwind.config";
import { ClockIcon } from "../../icons/icons";
import ForecastLabel from "../../national_forecast_labels";
import ChartCountryPicker from "../country-picker";
import useGlobalState from "../../helpers/globalState";
import { comparisonTitle } from "../../helpers/comparison";
const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;

export const ForecastHeadlineFigure: React.FC<{
  tip: string;
  color?: string;
  time?: string;
  unit?: string;
  gsp?: boolean;
  children?: React.ReactNode;
}> = ({ tip, color = yellow, time, unit = "GW", gsp = false, children }) => {
  const textSizeClasses = `font-semibold md:text-xl text-lg leading-none text-${color} pr-0.5 ${
    gsp
      ? "dash:2xl:text-5xl dash:xl:text-4xl xl:text-3xl lg:text-2xl"
      : "dash:3xl:text-6xl dash:xl:text-5xl lg:text-3xl"
  }`;
  return (
    <div
      data-test="pvlive-ocf-headline-figure"
      className="flex gap-3 items-center m-auto h-10 dash:h-14 justify-between"
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
            } flex flex-col dash:xl:gap-0 gap-1 items-start justify-center dash:xl:justify-between dash:justify-center pl-2`}
          >
            <div className="flex items-center text-white">
              {time && (
                <>
                  <ClockIcon />
                  <p className="text-xs dash:text-sm dash:xl:text-base ml-0.5 dash:leading-none leading-none">
                    {time}
                  </p>
                </>
              )}
            </div>
            <span className="text-xs dash:text-sm dash:xl:text-base text-ocf-gray-300 font-normal dash:leading-none leading-none">
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
    <div className="flex gap-3 items-center m-auto h-10 dash:h-14 justify-between">
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
            className={`flex text-xl xl:text-2xl items-center dash:text-6xl font-semibold leading-none mt-0.5 text-center text-${color}`}
            style={{ color: color }}
          >
            <span className="text-black">{pv}</span>
            <span className="text-ocf-gray-300 px-0.5"> / </span>
            {forecast}
            <div className="flex flex-col items-start pl-2">
              <div className="flex items-center text-white">
                <ClockIcon />
                <p className="text-xs dash:text-xl ml-0.5">{time}</p>
              </div>
              <span className="text-xs dash:text-lg text-ocf-gray-300 font-normal">
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
      className="flex gap-3 items-center m-auto h-10 dash:h-14 justify-between"
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
            className={`flex text-lg dash:text-6xl font-semibold leading-none mt-0.5 text-center text-${color}`}
            style={{ color: color }}
          >
            {pv}
            <div className="flex flex-col  items-start pl-2">
              <div className="items-center text-white hidden dash:flex">
                <ClockIcon />
                <p className="dash:text-xl ml-0.5">{time}</p>
              </div>
              <span className="text-xs dash:text-lg text-ocf-gray-300 font-normal"> GW</span>
            </div>
          </p>
        </div>
      </ForecastLabel>
      <div className="flex items-center dash:hidden -ml-[2px]">
        <ClockIcon />
        <p className="text-xs dash:text-base ml-0.5">{time}</p>
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
    <span className="text-ocf-gray-400 text-xs md:text-sm dash:text-lg" data-test="comparison-echo">
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
  return (
    <div
      data-test="national-chart-header"
      className="flex flex-initial content-between bg-ocf-gray-800 h-auto mb-4"
    >
      {/* The chart's country sits with the title because it qualifies it: these are GB's
          national numbers, not the app's. It is also the only country control on this half
          of the layout — the header owns which countries are *drawn*. */}
      <div className="m-auto ml-5 flex items-center gap-2">
        <ChartCountryPicker />
        <span className="text-white dash:3xl:text-5xl dash:2xl:text-4xl dash:xl:text-3xl dash:tracking-wide lg:text-2xl md:text-lg text-base font-black">
          National
        </span>
        <ComparisonEcho />
      </div>
      <div className="flex justify-between flex-2 my-2 dash:3xl:my-3 px-2 lg:px-4 3xl:px-6">
        <div className="pr-4 lg:pr-4 3xl:pr-6">
          <ForecastHeadlineFigure
            tip={`PV Live / OCF Forecast`}
            time={pvTimeOnly}
            color="ocf-yellow"
          >
            <span className="text-black">{actualPV}</span>
            <span className="text-ocf-gray-300 mx-1"> / </span>
            {forecastPV}
          </ForecastHeadlineFigure>
        </div>
        <div>
          <ForecastHeadlineFigure
            tip={`Next OCF Forecast`}
            time={forecastNextTimeOnly}
            color="ocf-yellow"
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
