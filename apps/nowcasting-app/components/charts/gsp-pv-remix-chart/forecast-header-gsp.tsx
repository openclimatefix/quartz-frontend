import React from "react";
import { CloseButtonIcon } from "../../icons";

type ForecastHeaderGSPProps = {
  title: string;
  mwpercent: number;
  onClose?: () => void;
};

const ForecastHeaderGSP: React.FC<ForecastHeaderGSPProps> = ({
  title,
  mwpercent,
  children,
  onClose
}) => {
  return (
    <div id="x" className={"flex content-between flex-wrap mt-6 bg-ocf-gray-800 h-12"}>
      <div
        className={`bg-ocf-gray-800 text-white lg:text-xl md:text-lg text-med font-black flex-[2] ml-5 m-auto py-2`}
      >
        {title}
      </div>
      <div className="flex flex-row justify-between flex-[1] m-auto px-5">
        <div className="lg:text-lg md:text-lg pr-5">
          <span className="font-semibold text-med text-ocf-yellow-500">{mwpercent}</span>
          <span className="text-xs text-ocf-gray-300"> %</span>
        </div>
        <div>{children}</div>
      </div>
      <div></div>
      <button
        type="button"
        onClick={onClose}
        className="font-bold items-center px-3 ml-2 text-2xl m text-white bg-ocf-gray-800 hover:bg-ocf-gray-700 focus:z-10 focus:text-white h-full"
      >
        <CloseButtonIcon />
      </button>
    </div>
  );
};

export default ForecastHeaderGSP;
