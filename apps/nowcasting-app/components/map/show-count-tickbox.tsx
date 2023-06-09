import React from "react";
import { useState } from "react";
import useGlobalState from "../helpers/globalState";

const ShowSiteCount: React.FC<{ showCount?: boolean }> = () => {
  const [showSiteCount, setShowSiteCount] = useGlobalState("showSiteCount");
  const toggleCount = () => {
    setShowSiteCount(!showSiteCount);
  };
  return (
    <div className="absolute top-20 right-10 right flex items-center mb-4">
      <input
        onClick={toggleCount}
        type="checkbox"
        value=""
        className="ring-none border-2 bg-black text-black"
      ></input>
      <label className="ml-2 text-base text-white font-medium">Show Site Count</label>
      {showSiteCount && (
        <div className="absolute top-14 right-10 right flex items-center mb-4 text-white">
          Showing site count.
        </div>
      )}
    </div>
  );
};

export default ShowSiteCount;
