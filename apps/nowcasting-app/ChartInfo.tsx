import React from "react";
import useGlobalState from "./components/helpers/globalState";
import { formatISODateStringHumanNumbersOnly } from "./components/helpers/utils";

export const ChartInfo: React.FC = () => {
  const [forecastCreationTime] = useGlobalState("forecastCreationTime");
  return (
    <div className="w-full w-64 p-2 text-sm">
      <ul className="list-none space-y-2">
        <li>All datetimes are in Europe/London timezone.</li>
        <li>
          Following{" "}
          <a
            className=" underline"
            href="https://www.solar.sheffield.ac.uk/pvlive/"
            target="_blank"
            rel="noreferrer"
          >
            PVLive
          </a>
          , datetimes show the end of the settlement period. For example 17:00 refers to solar
          generation between 16:30 to 17:00.
        </li>
        <li>The Y axis units are in MW, for the national and GSP plots.</li>
        <li>
          {" "}
          OCF Forecast Creation Time:{" "}
          {formatISODateStringHumanNumbersOnly(forecastCreationTime || "")}
        </li>
      </ul>
    </div>
  );
};
