import React, { useState, useEffect } from "react";

type ForecastTimeDisplayProps = {
  time?: string | undefined;
  icon: JSX.Element;
  forecastTag: string;
  alignRight?: boolean;
};

const ForecastTimeDisplay: React.FC<ForecastTimeDisplayProps> = ({
  time,
  icon,
  forecastTag,
  alignRight = false
}) => {
  return (
    <div
      className={`flex-col justify-end gap-1 inline-flex ${
        alignRight ? "items-end text-right" : "items-start"
      }`}
    >
      <div className="text-white text-xs font-sans uppercase">{forecastTag}</div>
      <div className="justify-start items-center inline-flex">
        <div className="w-4 h-4 relative mr-1">{icon}</div>
        <div className="text-white text-xl font-bold font-sans uppercase leading-3">{time}</div>
      </div>
    </div>
  );
};

export default ForecastTimeDisplay;
