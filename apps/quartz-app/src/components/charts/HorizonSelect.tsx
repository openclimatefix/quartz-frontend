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
    }
  };
  const handleUpdateHorizonMinutes = (e: ChangeEvent<HTMLSelectElement>) => {
    if (forecastHorizonMinuteOptions.includes(parseInt(e.target.value))) {
      setForecastHorizonMinutes(parseInt(e.target.value));
    }
  };
  return (
    <>
      <label className={forecastHorizon === "horizon" ? "" : "opacity-25"}>
        <span className="text-white mr-2">Horizon Hours</span>
        <select
          className="capitalize rounded-md py-1 px-2 bg-ocf-grey-900 text-white"
          onChange={handleUpdateHorizonMinutes}
          value={forecastHorizonMinutes}
          disabled={forecastHorizon !== "horizon"}
        >
          {forecastHorizonMinuteOptions.map((forecastHorizonMinuteOption) => (
            <option
              key={`horizonMinuteOption-${forecastHorizonMinuteOption}`}
              value={forecastHorizonMinuteOption}
            >
              {Number(forecastHorizonMinuteOption) / 60}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="text-white mr-2">Forecast</span>
        <select
          className="capitalize rounded-md py-1 px-2 bg-ocf-grey-900 text-white"
          onChange={handleUpdateHorizon}
          value={forecastHorizon}
        >
          {forecastHorizonTypes.map((forecastHorizonType) => (
            <option
              key={`horizonOption-${forecastHorizonType}`}
              value={forecastHorizonType}
            >
              {forecastHorizonType.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
    </>
  );
};

export default HorizonSelect;
