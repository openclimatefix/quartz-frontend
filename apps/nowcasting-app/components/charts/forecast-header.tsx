import React from "react";

const PVNumber: React.FC<{ pv: string; subTitle: string; color?: string }> = ({
  pv,
  subTitle,
  color = "amber-400",
}) => {
  return (
    <div className="flex-[1] m-auto">
      <div className="m-2">
        <p className={`lg:text-xl md:text-lg text-sm font-bold text-center text-${color}`}>
          {pv}
          <span className=" ml-2 text-mapbox-black-300">GW</span>
        </p>
        <p className="text-mapbox-black-300 whitespace-pre text-center ">{subTitle}</p>
      </div>
    </div>
  );
};
type ForecastHeaderProps = {
  forcastNextPV: string;
  forcastPV: string;
  actualPV: string;
  selectedTime: string;
};

const ForecastHeader: React.FC<ForecastHeaderProps> = ({
  forcastNextPV,
  forcastPV,
  actualPV,
  children,
  selectedTime,
}) => {
  return (
    <div className={"flex content-between flex-wrap mt-6 h-auto"}>
      <div
        className={` bg-white text-black lg:text-xl md:text-lg text-sm font-black  p-4  flex-[2] `}
      >
        National Solar PV Forecast
      </div>
      <PVNumber pv={actualPV} subTitle={`${selectedTime} actual`} color="black" />
      <PVNumber pv={forcastPV} subTitle={`${selectedTime} forecast`} />
      <PVNumber pv={forcastNextPV} subTitle="Forecast next" />
      <div className=" inline-flex items-center h-full m-auto">{children}</div>
    </div>
  );
};

export default ForecastHeader;
