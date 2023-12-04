import React from "react";
import { CloseButtonIcon } from "../../icons/icons";

type ForecastHeaderSiteProps = {
  title: string;
  onClose?: () => void;
  children?: React.ReactNode;
};

const ForecastHeaderSite: React.FC<ForecastHeaderSiteProps> = ({ title, onClose, children }) => {
  return (
    <div
      id="siteGroupChartHeader"
      className={"flex content-between flex-wrap bg-ocf-gray-800 h-12"}
    >
      <div className={`bg-ocf-gray-800 text-white text-base font-bold flex-[2] ml-5 m-auto py-2`}>
        {title}
      </div>
      {children}
      <button
        type="button"
        onClick={onClose}
        className="font-bold items-center px-3 text-2xl border-l-2 ml-2 border-mapbox-black-500 text-white bg-ocf-gray-800 hover:bg-ocf-gray-700 focus:z-10 focus:text-white h-full"
      >
        <CloseButtonIcon />
      </button>
    </div>
  );
};

export default ForecastHeaderSite;
