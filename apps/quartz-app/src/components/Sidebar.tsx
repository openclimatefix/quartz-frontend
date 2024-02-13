"use client"

import { ChevronLeft, ChevronRight, ClockIcon, ClockInlineSmall, HamburgerMenu, PowerIcon, RightArrow, SolarIcon, WindIcon } from "./icons/icons";
import { useState } from "react"; 

type SidebarProps = {
};

// set className so close button can be hidden unless hover on sidebar = true 
// function so that when i click on the close button, the sidebar collapse button shows up


function Sidebar() {
  let [expanded, setExpanded] = useState(true);
  function handleClick() {
  setExpanded(!expanded);
}
  if (expanded) {
    return (
      <div className="flex-0 w-96 justify-center items-center bg-444444">
        <div className="w-full h-full p-4 bg-neutral-700 flex-col justify-start items-start gap-5 inline-flex">
          <div className="justify-start items-start gap-[110px] flex-col">
          <div className="text-white text-lg font-bold font-sans leading-normal">Rajasthan</div>
            <button className="w-8 h-8 relative" onClick={handleClick}><ChevronLeft /></button>
            <div className="self-stretch h-[465px] flex-col justify-start items-start gap-4 flex">
              <div className="self-stretch h-[136px] flex-col justify-start items-start gap-2 flex">
                <div className="self-stretch justify-between items-start inline-flex">
                  <div className="text-white text-[64px] font-bold font-sans leading-[64px]">5.8</div>
                  <div className="justify-start items-center gap-2 flex">
                    <div className="w-8 h-8 relative"><PowerIcon /></div>
                    <div className="text-white text-base font-medium font-sans uppercase">Power</div>
                  </div>
                </div>
                <div className="self-stretch justify-between items-start inline-flex">
                  <div className="w-[105px] text-green-200 text-[64px] font-bold font-sans leading-[64px]">6.7</div>
                  <div className="text-green-200 text-[64px] font-bold font-sans leading-[64px]">4.2</div>
                </div>
              </div>
              <div className="w-[350px] h-px border border-white border-opacity-40"></div>
              <div className="self-stretch h-[39px] justify-start items-start gap-4 inline-flex">
                <div className="w-[101px] flex-col justify-end items-start gap-2 inline-flex">
                  <div className="text-white text-xs font-bold font-sans uppercase">NOW GW</div>
                  <div className="justify-start items-center inline-flex">
                    <div className="w-4 h-4 relative"><ClockIcon /></div>
                    <div className="text-white text-base font-bold font-sans uppercase leading-3">09:00</div>
                  </div>
                </div>
                <div className="flex-col justify-end items-start gap-2 inline-flex">
                  <div className="text-white text-xs font-bold font-sans uppercase">next GW</div>
                  <div className="justify-start items-center inline-flex">
                    <div className="w-4 h-4 relative"><ClockIcon /></div>
                    <div className="text-white text-base font-bold font-sans uppercase leading-3">09:15</div>
                  </div>
                </div>
              </div>
              <div className="self-stretch h-[104px] flex-col justify-start items-start gap-2 flex">
                <div className="self-stretch justify-between items-start inline-flex">
                  <div className="w-[94px] text-white text-5xl font-bold font-sans leading-[48px]">5.4</div>
                  <div className="h-8 justify-start items-center gap-2 flex">
                    <div className="w-8 h-8 relative"><SolarIcon /></div>
                    <div className="w-[60px] text-white text-base font-medium font-sans uppercase">Wind</div>
                    <div className="w-6 h-3 relative">
                      <div className="w-6 h-1 left-0 top-[4px] absolute bg-cyan-300 rounded-2xl"></div>
                    </div>
                  </div>
                </div>
                <div className="self-stretch justify-between items-start inline-flex">
                  <div className="w-[105px] text-cyan-300 text-5xl font-bold font-sans leading-[48px]">5.6</div>
                  <div className="w-[108px] text-cyan-300 text-5xl font-bold font-sans leading-[48px]">2.1</div>
                </div>
              </div>
              <div className="w-[350px] h-px border border-white border-opacity-40"></div>
              <div className="self-stretch h-[104px] flex-col justify-start items-start gap-2 flex">
                <div className="self-stretch justify-between items-start inline-flex">
                  <div className="w-[94px] text-white text-5xl font-bold font-sans leading-[48px]">0.4</div>
                  <div className="h-8 justify-center items-center gap-2 flex">
                    <div className="w-8 h-8 relative"><WindIcon /></div>
                    <div className="text-white text-base font-medium font-sans uppercase">Solar</div>
                    <div className="w-6 h-3 relative">
                      <div className="w-6 h-1 left-0 top-[4px] absolute bg-amber-300 rounded-2xl"></div>
                    </div>
                  </div>
                </div>
                <div className="self-stretch justify-between items-start inline-flex">
                  <div className="w-[105px] text-amber-300 text-5xl font-bold font-sans leading-[48px]">0.9</div>
                  <div className="w-[108px] text-amber-300 text-5xl font-bold font-sans leading-[48px]">2.1</div>
                </div>
              </div>
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
    <div className="self-stretch h-px mt-4 border border-white border-opacity-40"></div>
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
    <div className="self-stretch h-px mt-4 border border-white border-opacity-40"></div>
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
