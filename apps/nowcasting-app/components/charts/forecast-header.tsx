import React from "react";

type ForecastHeaderProps = { pv: number };

const ForecastHeader: React.FC<ForecastHeaderProps> = ({ pv }) => {
  return (
    <div id="x" className="flex mt-6">
      <div className="bg-white text-black text-2xl font-black flex-[2] p-4 items-center">
        National Solar PV Forecast
      </div>
      <div className="p-2 flex-[1]">
        <p className="text-2xl font-black text-center">
          {pv}
          <span className=" ml-2 text-mapbox-black-300">GW</span>
        </p>
        <p className="text-mapbox-black-300 text-center">generation</p>
      </div>
    </div>
  );
};

export default ForecastHeader;
