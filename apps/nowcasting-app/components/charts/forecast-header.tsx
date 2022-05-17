import React from "react";

type ForecastHeaderProps = { pv: number };

const ForecastHeader: React.FC<ForecastHeaderProps> = ({ pv }) => {
  return (
    <div id="x" className="grid grid-cols-3 mt-6">
      <div className="bg-white text-black text-lg md:text-2xl font-black col-span-2 p-4 flex items-center">
        National Solar PV Forecast
      </div>
      <div className="p-2 ">
        <p className="text-2xl font-black text-center">
          {pv}
          <span className="text-mapbox-black-300">GW</span>
        </p>
        <p className="text-mapbox-black-300 text-center">generation</p>
      </div>
    </div>
  );
};

export default ForecastHeader;
