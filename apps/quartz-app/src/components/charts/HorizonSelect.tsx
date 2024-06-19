import { ChangeEvent, FC } from "react";
import { components } from "@/src/types/schema";
import useGlobalState from "../helpers/globalState";

const HorizonSelect: FC = () => {
  const [forecastHorizon, setForecastHorizon] =
    useGlobalState("forecastHorizon");
  const [forecastHorizonMinutes, setForecastHorizonMinutes] = useGlobalState(
    "forecastHorizonMinutes"
  );
  const forecastHorizonTypes: components["schemas"]["ForecastHorizon"][] = [
    "latest",
    "horizon",
    "day_ahead",
  ];
  const forecastHorizonMinuteOptions = [90, 180];

  const handleUpdateHorizon = (e: ChangeEvent<HTMLSelectElement>) => {
    if (
      Object.values(forecastHorizonTypes).includes(
        e.target.value as components["schemas"]["ForecastHorizon"]
      )
    ) {
      setForecastHorizon(
        e.target.value as components["schemas"]["ForecastHorizon"]
      );
    } else {
      if (e.target.value.includes("horizon")) {
        const horizonValue =
          e.target.selectedOptions[0].getAttribute("data-horizon-value");
        if (!horizonValue) return console.error("No horizon value found");

        setForecastHorizon("horizon");
        const horizonValueInt = parseInt(horizonValue);
        setForecastHorizonMinutes(horizonValueInt);
      }
    }
  };
  return (
    <>
      <label>
        <span className="text-white mr-2">Forecast</span>
        <select
          className="capitalize rounded-md py-1 px-2 bg-ocf-grey-900 text-white"
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
                  <option
                    key={`horizonOption-${forecastHorizonType}`}
                    value={forecastHorizonType}
                  >
                    {forecastHorizonType.replace("_", " ")}
                  </option>
                );
              case "horizon":
                return (
                  <>
                    {forecastHorizonMinuteOptions.map(
                      (forecastHorizonMinuteOption) => (
                        <option
                          key={`horizonMinuteOption-${forecastHorizonMinuteOption}`}
                          value={`${forecastHorizonType}-${forecastHorizonMinuteOption}`}
                          data-horizon-value={forecastHorizonMinuteOption}
                        >
                          Horizon {Number(forecastHorizonMinuteOption) / 60}h
                        </option>
                      )
                    )}
                  </>
                );
            }
          })}
        </select>
      </label>
    </>
  );
};

export default HorizonSelect;
