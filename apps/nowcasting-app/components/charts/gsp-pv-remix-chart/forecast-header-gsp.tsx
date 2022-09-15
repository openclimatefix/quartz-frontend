import React from "react";

type ForecastHeaderGSPProps = {
  title: string;
  onClose?: () => void;
};

const ForecastHeaderGSP: React.FC<ForecastHeaderGSPProps> = ({ title, children, onClose }) => {
  return (
    <div id="x" className={"flex content-between flex-wrap mt-6 bg-ocf-yellow bg-opacity-60 h-12"}>
      <div className={`bg-white text-black text-2xl font-black  p-4 py-2  flex-[1]`}>{title}<span className={`text-base text-ocf-gray-900 ml-5`}>MW</span></div>
      <div className="flex-[1] m-auto">
        <p className="text-lg text-center align-middle m-auto mx-2">{children}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="font-bold inline-flex items-center  px-3 ml-2 text-lg m text-black bg-ocf-yellow  hover:bg-ocf-yellow focus:z-10 focus:bg-ocf-yellow focus:text-black h-full"
      >
        Close
      </button>
    </div>
  );
};

export default ForecastHeaderGSP;
