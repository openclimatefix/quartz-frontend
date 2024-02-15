import React, { useState, useEffect } from 'react';

type ForecastTimeDisplayProps = {
  time: string;
  icon: JSX.Element;
  forecastTag: string;
}
const ForecastTimeDisplay: React.FC<ForecastTimeDisplayProps> = ({time, icon, forecastTag}) => {

  return (
    <div className="w-[101px] flex-col justify-end items-start gap-2 inline-flex">
                  <div className="text-white text-xs font-bold font-sans uppercase">{forecastTag}</div>
                  <div className="justify-start items-center inline-flex">
                    <div className="w-4 h-4 relative">{icon}</div>
                    <div className="text-white text-base font-bold font-sans uppercase leading-3">{time}</div>
                  </div>
                </div>
  );
};

export default ForecastTimeDisplay;