import React from "react";
import useGlobalState from "./components/helpers/globalState";
import { formatISODateStringHumanNumbersOnly } from "./components/helpers/utils";

export const ChartInfo: React.FC = () => {
  const [forecastCreationTime] = useGlobalState("forecastCreationTime");
  return (
    <div className="text-left p-1 text-sm mb-1 cursor-default">
      <ul className="list-none space-y-2">
        <li>All datetimes are in Europe/London timezone.</li>
        <li>
          Following{" "}
          <span className="underline font-bold"><a
            href="https://www.solar.sheffield.ac.uk/pvlive/"
            target="_blank"
            rel="noreferrer"
          >
        PV_Live
          </a></span>
          , datetimes show the end of the settlement period. <br />
          For example, 17:00 refers to solar generation between 16:30 to 17:00.
        </li>
        <li>The Y axis units are in MW for the National and GSP charts.</li>
        <br/>
        <li>To learn more, please see our <span className="underline font-bold"><a
        href="https://openclimatefix.notion.site/How-to-use-the-Quartz-Solar-site-053005e5db144f6dbd7a3d0fe108d7f2"
            target="_blank"
            rel="noreferrer">documentation</a></span>.</li>
      </ul>
    </div>
  );
};
