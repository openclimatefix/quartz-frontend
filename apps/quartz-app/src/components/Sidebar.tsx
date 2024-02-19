"use client"

import { ChevronLeft, ChevronRight, ClockIcon, ClockInlineSmall, HamburgerMenu, PowerIcon, RightArrow, SolarIcon, WindIcon } from "./icons/icons";
import { useState } from "react"; 
import WideCard from "./sidebar-components/card";
import ForecastTimeDisplay from "./sidebar-components/time-label";
import MiniCard from "./sidebar-components/mini-card";
import { text } from "stream/consumers";

type SidebarProps = {
  title : string;
};

const data = {
  actualPowerGeneration: 5.8,
  currentPowerForecast: 6.7,
  nextPowerForecast: 4.2,
  actualWindGeneration: 5.4,
  currentWindForecast: 5.6,
  nextWindForecast: 2.1,
  actualSolarGeneration: 0.4,
  currentSolarForecast: 0.9,
  nextSolarForecast: 2.1,
}


const Sidebar: React.FC<SidebarProps> = ({title}) => {
  let [expanded, setExpanded] = useState(true);
  function handleClick() {
  setExpanded(!expanded);
}
  if (expanded) {
    return (
      <div className="flex-0 w-96 justify-center items-center bg-444444">
        <div className="w-full h-full p-4 bg-neutral-700 flex-col justify-start items-start gap-5 inline-flex">
          <div className="justify-start items-start gap-[110px] flex-col">
            <div className="flex justify-between"><
              div className="text-white text-lg font-bold font-sans leading-normal">{title}</div>
              <button className="w-8 h-8 relative" onClick={handleClick}><ChevronLeft /></button>
            </div>
          
            <div className="self-stretch h-[465px] flex-col justify-start items-start gap-4 flex">
              {/* start card */}
              <WideCard
                icon={<PowerIcon />}
                actualGeneration={data.actualPowerGeneration}
                currentForecast={data.currentPowerForecast}
                nextForecast={data.nextPowerForecast}
                energyTag="Power"
                bgTheme="bg-quartz-energy-100"
                textTheme="text-quartz-energy-100"/>
              {/* end card */}
              <div className="w-[350px] h-px border border-white border-opacity-40"></div>
               <div className="self-stretch h-[39px] justify-start items-start gap-4 inline-flex">
              <ForecastTimeDisplay
                time="09:00"
                icon={<ClockIcon />}
                forecastTag="NOW GW" />
              <ForecastTimeDisplay 
                time="09:15"
                icon={<ClockIcon />}
                  forecastTag="NEXT GW" />
                </div>
              <WideCard
                icon={<WindIcon />}
                actualGeneration={data.actualWindGeneration}
                currentForecast={data.currentWindForecast}
                nextForecast={data.nextWindForecast}
                energyTag="Wind"
                textTheme="text-quartz-energy-200"
                bgTheme="bg-quartz-energy-200"/>
              <div className="w-[350px] h-px border border-white border-opacity-40"></div>
              <WideCard
                icon={<SolarIcon />}
                actualGeneration={data.actualSolarGeneration}
                currentForecast={data.currentSolarForecast}
                nextForecast={data.nextSolarForecast}
                energyTag="Solar"
                textTheme="text-quartz-energy-300"
                bgTheme="bg-quartz-energy-300"/>
              </div>
            </div>
          </div>
        </div>
    )
  }
  else {
    return (
      <div className="flex-0 justify-center items-center bg-444444">
      <div className="w-14 h-full px-2 py-4 bg-neutral-700 flex-col justify-start items-center gap-5 inline-flex">
        <div className="justify-start items-start gap-[110px] inline-flex ">
    <button className="w-6 h-6 relative rounded-lg" onClick={handleClick}><HamburgerMenu/></button>
     </div>
          <div className="self-stretch h-[354px] flex-col justify-start items-start gap-4 flex">
            <MiniCard
              icon={<PowerIcon />}
              textTheme={"text-quartz-energy-100"}
              bgTheme={"bg-quartz-energy-100"}
              actualGeneration={data.actualPowerGeneration}
              nextForecast={data.nextPowerForecast}
              />
             <div className="w-full h-px mt-4 border border-white border-opacity-40"></div>
            <MiniCard
              icon={<WindIcon/>}
              textTheme={"text-quartz-energy-200"}
              bgTheme={"bg-quartz-energy-200"}
              actualGeneration={data.actualWindGeneration}
              nextForecast={data.nextPowerForecast}
               />
            <div className="w-full h-px mt-4 border border-white border-opacity-40"></div>
            <MiniCard
              icon={<SolarIcon />}
              textTheme={"text-quartz-energy-300"}
              bgTheme={"bg-quartz-energy-300"}
              actualGeneration={data.actualSolarGeneration}
              nextForecast={data.nextSolarForecast}
              />
          </div>
        </div>
      </div>
    
    )
  }
}

export default Sidebar;
