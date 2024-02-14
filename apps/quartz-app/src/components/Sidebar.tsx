"use client"

import { ChevronLeft, ChevronRight, ClockIcon, ClockInlineSmall, HamburgerMenu, PowerIcon, RightArrow, SolarIcon, WindIcon } from "./icons/icons";
import { useState } from "react"; 
import WideCard from "./sidebar-components/wide-card";
import ForecastTimeDisplay from "./sidebar-components/forecast-time";

type SidebarProps = {
  title : string;
};


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
          <div className="text-white text-lg font-bold font-sans leading-normal">{title}</div>
            <button className="w-8 h-8 relative" onClick={handleClick}><ChevronLeft /></button>
            <div className="self-stretch h-[465px] flex-col justify-start items-start gap-4 flex">
              {/* start card */}
              <WideCard
                icon={<PowerIcon />}
                actualGeneration={5.8}
                currentForecast={6.7}
                nextForecast={4.2}
                energyTag="Power"
                theme="green-200" />
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
                  forecastTag="Next GW" />
                </div>
              <WideCard
                icon={<WindIcon />}
                actualGeneration={5.4}
                currentForecast={5.6}
                nextForecast={2.1}
                energyTag="Wind"
                theme="cyan-300" />
              <div className="w-[350px] h-px border border-white border-opacity-40"></div>
              <WideCard
                icon={<SolarIcon />}
                actualGeneration={0.4}
                currentForecast={0.9}
                nextForecast={2.1}
                energyTag="Solar"
                theme="amber-300" />
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
        <div className="justify-start items-start gap-[110px] inline-flex">
    <button className="w-6 h-6 relative rounded-lg" onClick={handleClick}><HamburgerMenu/></button>
  </div>
          <div className="self-stretch h-[354px] flex-col justify-start items-start gap-4 flex">
            {/* start card */}
    <div className="self-stretch h-[84px] flex-col justify-start items-start gap-4 flex">
      <div className="self-stretch h-10 flex-col justify-start items-start gap-2 flex">
              <div className="self-stretch justify-center items-center gap-2 inline-flex">
                <PowerIcon />
          <div className="w-4 h-4 relative"></div>
        </div>
        <div className="self-stretch text-center text-white text-base font-bold font-sans leading-none">5.8</div>
      </div>
      <div className="self-stretch h-7 flex-col justify-start items-center gap-1 flex">
        <div className="h-2 px-2 py-4 justify-center items-center gap-2 inline-flex"><RightArrow/></div>
        <div className="text-center text-green-200 text-base font-bold font-sans leading-none mb-2">4.2</div>
      </div>
            </div>
            {/* end card */}
            <div className="self-stretch h-px mt-4 border border-white border-opacity-40"></div>
            {/* start card */}
    <div className="self-stretch h-[100px] flex-col justify-start items-start gap-4 flex">
      <div className="self-stretch h-14 flex-col justify-start items-center gap-1 flex">
              <div className="h-9 flex-col justify-center items-center gap-2 flex">
                <SolarIcon/>
          <div className="w-4 h-4 relative"></div>
          <div className="w-6 h-3 relative">
            <div className="w-6 h-1 left-0 top-[4px] mt-5 absolute bg-cyan-300 rounded-2xl"></div>
          </div>
        </div>
        <div className="self-stretch text-center text-white text-base font-bold font-sans leading-none">5.4</div>
      </div>
      <div className="self-stretch h-7 flex-col justify-start items-center gap-1 flex">
        <div className="h-2 px-2 py-4 justify-center items-center gap-2 inline-flex"><RightArrow/></div>
        <div className="self-stretch text-center text-cyan-300 text-base font-bold font-sans leading-none">2.1</div>
      </div>
            </div>
            {/* end card */}
            <div className="self-stretch h-px mt-4 border border-white border-opacity-40"></div>
            {/* start card */}
    <div className="self-stretch h-[104px] flex-col justify-start items-start gap-4 flex">
      <div className="self-stretch h-[60px] flex-col justify-start items-start gap-2 flex">
              <div className="self-stretch h-9 flex-col justify-center items-center gap-2 flex">
                <WindIcon/>
          <div className="w-4 h-4 relative"></div>
          <div className="w-6 h-3 relative">
            <div className="w-6 h-1 left-0 top-[4px] mt-6 absolute bg-amber-300 rounded-2xl"></div>
          </div>
        </div>
        <div className="self-stretch text-center text-white text-base font-bold font-sans leading-none">0.4</div>
      </div>
      <div className="self-stretch h-7 flex-col justify-start items-center gap-1 flex">
        <div className="h-2 px-2 py-4 justify-center items-center gap-2 inline-flex"><RightArrow/></div>
        <div className="self-stretch text-center text-amber-300 text-base font-bold font-sans leading-none">2.1</div>
      </div>
            </div>
            {/* end card */}
  </div>
        </div>
        </div>
      // <div className="flex-0 w-16 justify-center items-center flex bg-444444">
      //   <div className="w-full h-full p-4 bg-neutral-700 flex-col justify-start items-start gap-5 inline-flex">
      //     <div className="justify-start items-start gap-[110px] inline-flex">
      //       <button onClick={handleClick}><HamburgerMenu/></button>
      //       <button className="w-8 h-8 relative" onClick={handleClick}><ChevronRight /></button>
      //     </div>
      //   </div>
      // </div>
    )
  }
}


export default Sidebar;
