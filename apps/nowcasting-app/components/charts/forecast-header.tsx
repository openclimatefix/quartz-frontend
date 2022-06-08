import React from "react";
import PlatButton from "../play-button";

type ForecastHeaderProps = { pv: string };

const ForecastHeader: React.FC<ForecastHeaderProps> = ({ pv, children }) => {
  return (
    <div className={"flex content-between flex-wrap mt-6  h-16"}>
      <div className={`bg-white text-black text-2xl font-black  p-4  flex-[2]`}>
        National Solar PV Forecast
      </div>
      <div className="flex-[1] m-auto">
        <p className="text-2xl font-black text-center">
          {pv}
          <span className=" ml-2 text-mapbox-black-300">GW</span>
        </p>
        <p className="text-mapbox-black-300 text-center">generation</p>
      </div>
      <div className=" inline-flex items-center h-full">
        <PlatButton></PlatButton>
      </div>
    </div>
  );
};

export default ForecastHeader;
