import { ChangeEvent, FC } from "react";
import { components } from "@/src/types/schema";
import useGlobalState from "../helpers/globalState";
import { InfoIcon } from "../icons/icons";
import InfoTooltip from "../InfoTooltip";

const HorizonInfo: FC = () => {
  return (
    <InfoTooltip
      tip={
        <div className="rounded-md w-max max-w-64 leading-4 flex flex-col gap-2">
          <div>
            <b className="text-sm">Latest</b>
            <p>The most up-to-date forecast data available</p>
          </div>
          <div>
            <b className="text-sm">Horizon 1.5h/3h</b>
            <p>The forecast made N hours before the target time. </p>
            <p>E.g. The 3 hour horizon forecast for 11am, was created at 8am the same day.</p>
          </div>
          <div>
            <b className="text-sm">Day Ahead</b>
            <p>Forecast at 9.00 IST the day before. </p>
            <p>
              E.g. The forecast for 11am, or any time in a day, was created at 9am the day before.
            </p>
          </div>
        </div>
      }
      position="left"
      className={""}
      fullWidth
    >
      <InfoIcon className="text-white self-center ml-2" />
    </InfoTooltip>
  );
};

const HorizonSelect: FC = () => {
  const [forecastHorizon, setForecastHorizon] = useGlobalState("forecastHorizon");
  const [forecastHorizonMinutes, setForecastHorizonMinutes] =
    useGlobalState("forecastHorizonMinutes");
  const forecastHorizonTypes: components["schemas"]["ForecastHorizon"][] = [
    "latest",
    "horizon",
    "day_ahead"
  ];
  const forecastHorizonMinuteOptions = [90, 180];

  const handleUpdateHorizon = (e: ChangeEvent<HTMLSelectElement>) => {
    if (
      Object.values(forecastHorizonTypes).includes(
        e.target.value as components["schemas"]["ForecastHorizon"]
      )
    ) {
      setForecastHorizon(e.target.value as components["schemas"]["ForecastHorizon"]);
    } else {
      if (e.target.value.includes("horizon")) {
        const horizonValue = e.target.selectedOptions[0].getAttribute("data-horizon-value");
        if (!horizonValue) return console.error("No horizon value found");

        setForecastHorizon("horizon");
        const horizonValueInt = parseInt(horizonValue);
        setForecastHorizonMinutes(horizonValueInt);
      }
    }
  };
  return (
    <div className="flex flex-1 mr-2 z-20">
      <label>
        <span className="text-gray-200 mr-2 text-xs uppercase">Forecast</span>
        <select
          className="capitalize rounded-md py-1 px-2 text-sm bg-ocf-grey-900 text-white"
          onChange={handleUpdateHorizon}
          value={
            forecastHorizon.includes("horizon")
              ? `horizon-${forecastHorizonMinutes}`
              : forecastHorizon
          }
        >
          {forecastHorizonTypes.map((forecastHorizonType) => {
            switch (forecastHorizonType) {
              case "latest":
              case "day_ahead":
                return (
                  <option key={`horizonOption-${forecastHorizonType}`} value={forecastHorizonType}>
                    {forecastHorizonType.replace("_", " ")}
                  </option>
                );
              case "horizon":
                return (
                  <>
                    {forecastHorizonMinuteOptions.map((forecastHorizonMinuteOption) => (
                      <option
                        key={`horizonMinuteOption-${forecastHorizonMinuteOption}`}
                        value={`${forecastHorizonType}-${forecastHorizonMinuteOption}`}
                        data-horizon-value={forecastHorizonMinuteOption}
                      >
                        Horizon {Number(forecastHorizonMinuteOption) / 60}h
                      </option>
                    ))}
                  </>
                );
            }
          })}
        </select>
      </label>
      <div className="flex items-center">
        <HorizonInfo />
      </div>
    </div>
  );
};

export default HorizonSelect;
