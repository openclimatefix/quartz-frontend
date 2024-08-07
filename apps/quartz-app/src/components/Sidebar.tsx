"use client";
import { useGetRegionsQuery } from "@/src/hooks/queries";
import { components } from "@/src/types/schema";
import { useGlobalState } from "../components/helpers/globalState";
import {
  ChevronLeft,
  ClockIcon,
  HamburgerMenu,
  PowerIcon,
  SolarIcon,
  WindIcon,
  SolarIcon24,
  WindIcon24,
  ChevronRight,
} from "./icons/icons";
import { useState } from "react";
import WideCard from "./sidebar-components/card";
import ForecastTimeDisplay from "./sidebar-components/time-label";
import MiniCard from "./sidebar-components/mini-card";
import { DateTime } from "luxon";
import { FC } from "react";
import { get } from "http";

type SidebarProps = {
  title: string;
  solarGenerationData:
    | components["schemas"]["GetHistoricGenerationResponse"]
    | undefined;
  windGenerationData:
    | components["schemas"]["GetHistoricGenerationResponse"]
    | undefined;
  windForecastData:
    | components["schemas"]["GetForecastGenerationResponse"]
    | undefined;
  solarForecastData:
    | components["schemas"]["GetForecastGenerationResponse"]
    | undefined;
};

const Sidebar: React.FC<SidebarProps> = ({
  solarGenerationData,
  windGenerationData,
  solarForecastData,
  windForecastData,
  title,
}) => {
  const convertDatestampToEpoch = (time: string) => {
    const date = new Date(time.slice(0, 16));
    return date.getTime();
  };

  const [visibleLines, setVisibleLines] = useGlobalState("visibleLines");

  const getNowInTimezone = () => {
    const now = DateTime.now().setZone("ist");
    return DateTime.fromISO(now.toString().slice(0, 16)).set({
      hour: now.minute >= 45 ? now.hour + 1 : now.hour,
      minute: now.minute < 45 ? Math.floor(now.minute / 15) * 15 : 0,
      second: 0,
      millisecond: 0,
    });
  };

  const getNext15MinSlot = () => {
    const now = getNowInTimezone();
    if (now.minute >= 45) {
      return now.plus({ hours: 1 }).set({ minute: 0 });
    } else if (now.minute < 45) {
      return now.set({ minute: Math.floor(now.minute / 15) * 15 + 15 });
    } else {
      return now;
    }
  };

  const getEpochNowInTimezone = () => {
    return getNowInTimezone().toMillis();
  };

  const getEpochNowInTimezonePlus15 = () => {
    return getNext15MinSlot().toMillis();
  };

  // function to get the current time as 00:00 format
  const prettyPrintNowTime = () => {
    return getNowInTimezone().toFormat("HH:mm");
  };

  // function to get the next 15 min slot as 00:00 format
  const prettyPrintNextTime = () => {
    return getNext15MinSlot().toFormat("HH:mm");
  };

  let formattedSidebarData: {
    timestamp: number;
    time?: string;
    solar_forecast?: number;
    wind_forecast?: number;
    solar_generation?: number;
    wind_generation?: number;
  }[] = [];

  if (windForecastData?.values) {
    for (const value of windForecastData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedSidebarData?.find(
        (data) => data.timestamp === timestamp
      );
      if (existingData) {
        existingData.wind_forecast = value.PowerKW / 1000;
      } else {
        formattedSidebarData.push({
          timestamp,
          wind_forecast: value.PowerKW / 1000,
        });
      }
    }
  }

  if (solarForecastData?.values) {
    console.log("solarForecastData", solarForecastData);
    for (const value of solarForecastData?.values) {
      const time = value.Time;
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedSidebarData?.find(
        (data) => data.timestamp === timestamp
      );
      if (existingData) {
        existingData.solar_forecast = value.PowerKW / 1000;
      } else {
        formattedSidebarData.push({
          timestamp,
          time,
          solar_forecast: value.PowerKW / 1000,
        });
      }
    }
  }

  if (solarGenerationData?.values) {
    for (const value of solarGenerationData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedSidebarData?.find(
        (data) => data.timestamp === timestamp
      );
      if (
        existingData &&
        (existingData.solar_forecast || existingData.wind_forecast)
      ) {
        existingData.solar_generation = value.PowerKW / 1000;
      }
    }
  }

  if (windGenerationData?.values) {
    for (const value of windGenerationData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedSidebarData?.find(
        (data) => data.timestamp === timestamp
      );
      if (
        existingData &&
        (existingData.solar_forecast || existingData.wind_forecast)
      ) {
        existingData.wind_generation = value.PowerKW / 1000;
      }
    }
  }

  const formattedSideBarData = formattedSidebarData.sort(
    (a, b) => a.timestamp - b.timestamp
  );

  let solarForecastNow = formattedSideBarData.find(
    (data) => data.timestamp === getEpochNowInTimezone()
  )?.solar_forecast;
  solarForecastNow = Number(solarForecastNow) || 0;

  let windForecastNow =
    formattedSideBarData.find(
      (data) => data.timestamp === getEpochNowInTimezone()
    )?.wind_forecast || 0;
  windForecastNow = Number(windForecastNow) || 0;

  // get the next 15 min slot solar forecast

  let solarForecastNext =
    formattedSideBarData.find(
      (data) => data.timestamp === getEpochNowInTimezonePlus15()
    )?.solar_forecast || 0;
  solarForecastNext = Number(solarForecastNext) || 0;

  let windForecastNext =
    formattedSideBarData.find(
      (data) => data.timestamp === getEpochNowInTimezonePlus15()
    )?.wind_forecast || 0;
  windForecastNext = Number(windForecastNext) || 0;

  const powerForecastNow = Number(windForecastNow + solarForecastNow) || 0;
  const powerForecastNext = Number(windForecastNext + solarForecastNext) || 0;

  let actualWindGeneration = formattedSideBarData.find(
    (data) => data.timestamp === getEpochNowInTimezone()
  )?.wind_generation;
  actualWindGeneration = Number(actualWindGeneration) || 0;

  let actualSolarGeneration =
    formattedSideBarData.find(
      (data) => data.timestamp === getEpochNowInTimezone()
    )?.solar_generation || 0;
  actualSolarGeneration = Number(actualSolarGeneration) || 0;

  let actualPowerGeneration =
    Number(actualWindGeneration + actualSolarGeneration) || 0;

  let [expanded, setExpanded] = useState(true);

  function handleClick() {
    setExpanded(!expanded);
    setShowChevronRight(false);
  }

  const [showChevronLeft, setShowChevronLeft] = useState(false);
  const [showChevronRight, setShowChevronRight] = useState(false);

  function handleMouseEnterExpanded() {
    setShowChevronLeft(true);
  }

  function handleMouseLeaveExpanded() {
    setShowChevronLeft(false);
  }

  function handleMouseEnterCollapsed() {
    setShowChevronRight(true);
  }

  function handleMouseLeaveCollapsed() {
    setShowChevronRight(false);
  }

  if (expanded) {
    return (
      <div
        className="flex-0 w-96 justify-center items-center bg-444444"
        onMouseEnter={handleMouseEnterExpanded}
        onMouseLeave={handleMouseLeaveExpanded}
      >
        <div className="w-full h-full p-4 bg-neutral-700 flex-col justify-start items-start gap-5 flex">
          <div className="self-stretch gap-[110px] flex-col">
            <div className="flex justify-between mb-3">
              <button
                className={`flex items-center justify-center p-2 -mt-1 -ml-1 hover:bg-ocf-grey-400 hover:duration-500 rounded-lg ${
                  showChevronLeft ? "" : "opacity-0"
                }`}
                onClick={handleClick}
              >
                <ChevronLeft />
              </button>
              <div className="text-white text-lg font-bold font-sans leading-normal">
                {/*{title}*/}
                {/* Date in format Wed, 20 March 2024 */}
                {DateTime.now().toLocaleString({
                  weekday: "short",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
            <hr className="border-white/50 my-3 mb-5" />

            <div className="flex-1 self-stretch h-[39px] justify-between mb-6 items-start gap-16 flex">
              <ForecastTimeDisplay
                time={prettyPrintNowTime()}
                icon={<ClockIcon />}
                forecastTag="LATEST MW"
              />
              <ForecastTimeDisplay
                time={prettyPrintNextTime()}
                icon={<ClockIcon />}
                forecastTag="NEXT MW"
                alignRight={true}
              />
            </div>
            <div className="self-stretch flex-col justify-start items-start gap-5 flex">
              {/* start card */}
              <WideCard
                icon={<PowerIcon />}
                actualGeneration={
                  actualPowerGeneration > 0 ? (
                    actualPowerGeneration.toLocaleString("hi-IN", {
                      maximumFractionDigits: 0,
                    })
                  ) : (
                    <div className="flex flex-col mb-2 text-base text-gray-300 leading-tight break-word border border-dashed border-gray-300 p-2 px-3 rounded-md">
                      <span>Generation Data</span>
                      <span>Unavailable</span>
                    </div>
                  )
                }
                currentForecast={
                  powerForecastNow.toLocaleString("hi-IN", {
                    maximumFractionDigits: 0,
                  }) || 0
                }
                nextForecast={
                  powerForecastNext.toLocaleString("hi-IN", {
                    maximumFractionDigits: 0,
                  }) || 0
                }
                energyTag="Power"
                bgTheme="bg-quartz-mint-green"
                textTheme="text-quartz-mint-green"
              />
              {/* end card */}
              <hr className="w-full border-white/50" />
              <WideCard
                icon={<SolarIcon />}
                actualGeneration={
                  actualSolarGeneration > 0
                    ? actualSolarGeneration.toLocaleString("hi-IN", {
                        maximumFractionDigits: 0,
                      })
                    : "-.--"
                }
                currentForecast={
                  solarForecastNow.toLocaleString("hi-IN", {
                    maximumFractionDigits: 0,
                  }) || 0
                }
                nextForecast={
                  solarForecastNext.toLocaleString("hi-IN", {
                    maximumFractionDigits: 0,
                  }) || 0
                }
                energyTag="Solar"
                textTheme="text-quartz-yellow"
                bgTheme="bg-quartz-yellow"
                toggle={true}
              />
              <hr className="w-full border-white/50" />
              <WideCard
                icon={<WindIcon />}
                actualGeneration={
                  actualWindGeneration > 0
                    ? actualWindGeneration.toLocaleString("hi-IN", {
                        maximumFractionDigits: 0,
                      })
                    : "-.--"
                }
                currentForecast={
                  windForecastNow.toLocaleString("hi-IN", {
                    maximumFractionDigits: 0,
                  }) || 0
                }
                nextForecast={
                  windForecastNext.toLocaleString("hi-IN", {
                    maximumFractionDigits: 0,
                  }) || 0
                }
                energyTag="Wind"
                textTheme="text-quartz-blue"
                bgTheme="bg-quartz-blue"
                toggle={true}
              />
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div
        className="flex-0 justify-center items-center bg-444444"
        onMouseEnter={handleMouseEnterCollapsed}
        onMouseLeave={handleMouseLeaveCollapsed}
      >
        <div className="w-14 h-full px-2 py-4 bg-neutral-700 flex-col justify-start items-center gap-5 inline-flex">
          <div className="justify-start items-start gap-[110px] inline-flex ">
            {/* // on hover, set showChevronRight to true show the chevron, otherwise show the hamburger menu*/}
            {showChevronRight ? (
              <button
                className="p-2 -mt-1 -ml-1 flex justify-center items-center rounded-lg hover:bg-ocf-grey-400 hover:duration-300"
                onClick={handleClick}
              >
                <ChevronRight />
              </button>
            ) : (
              <div className="p-2 -mt-1 -ml-1 flex justify-center items-center rounded-lg">
                <HamburgerMenu className="text-white" />
              </div>
            )}
          </div>
          <div className="self-stretch flex-col justify-start items-start flex">
            <MiniCard
              icon={<PowerIcon />}
              textTheme={"text-quartz-mint-green"}
              bgTheme={"bg-quartz-mint-green"}
              actualGeneration={
                actualPowerGeneration > 0
                  ? actualPowerGeneration.toFixed(0)
                  : "-.-"
              }
              nextForecast={powerForecastNext.toFixed(0) || 0}
              energyTag="Power"
            />
            <div className="w-full mb-4 h-px border border-white border-opacity-40"></div>
            <MiniCard
              icon={<WindIcon24 />}
              textTheme={"text-quartz-blue"}
              bgTheme={"bg-quartz-blue"}
              actualGeneration={
                actualWindGeneration > 0
                  ? actualWindGeneration.toFixed(0)
                  : "-.-"
              }
              nextForecast={windForecastNext.toFixed(0) || 0}
              toggle={true}
              energyTag="Wind"
            />
            <div className="w-full mb-4 h-px border border-white border-opacity-40"></div>
            <MiniCard
              icon={<SolarIcon24 />}
              textTheme={"text-quartz-yellow"}
              bgTheme={"bg-quartz-yellow"}
              actualGeneration={
                actualSolarGeneration > 0
                  ? actualSolarGeneration.toFixed(0)
                  : "-.-"
              }
              nextForecast={solarForecastNext.toFixed(0) || 0}
              toggle={true}
              energyTag="Solar"
            />
          </div>
        </div>
      </div>
    );
  }
};

export default Sidebar;
