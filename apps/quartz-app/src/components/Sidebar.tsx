"use client";
import { useGetRegionsQuery } from "@/src/hooks/queries";
import { components } from "@/src/types/schema";
import {
  ChevronLeft,
  ClockIcon,
  HamburgerMenu,
  PowerIcon,
  SolarIcon,
  WindIcon,
} from "./icons/icons";
import { useState } from "react";
import WideCard from "./sidebar-components/card";
import ForecastTimeDisplay from "./sidebar-components/time-label";
import MiniCard from "./sidebar-components/mini-card";
import { DateTime } from "luxon";
import next from "next";
import { get } from "http";

type SidebarProps = {
  title: string;
    solarGenerationData:
    | components["schemas"]["GetHistoricGenerationResponse"]
    | undefined;
  windGenerationData:
    | components["schemas"]["GetHistoricGenerationResponse"]
    | undefined;
  solarForecastData:
    | components["schemas"]["GetForecastGenerationResponse"]
    | undefined;
  windForecastData:
    | components["schemas"]["GetForecastGenerationResponse"]
    | undefined;
};

// const data = {
//   actualPowerGeneration: 5.8,
//   currentPowerForecast: 6.7,
//   nextPowerForecast: 4.2,
//   actualWindGeneration: 5.4,
//   currentWindForecast: 5.6,
//   nextWindForecast: 2.1,
//   actualSolarGeneration: 0.4,
//   currentSolarForecast: 0.9,
//   nextSolarForecast: 2.1,
// };

const Sidebar: React.FC<SidebarProps> = ({
  windForecastData,
  windGenerationData,
  solarForecastData,
  solarGenerationData,
  title,
}) => {
  // function to convert the datestamp to epoch

  const convertDatestampToEpoch = (time: string) => {
    const date = new Date(time.slice(0, 16));
    return date.getTime();
  };

  const formatDate = (time: number) => {
    const date = new Date(time);
    date.toLocaleString();
  };


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
      return now.set({ minute: ((Math.floor(now.minute / 15) * 15) + 15) });
    }
  }

  const getEpochNowInTimezone = () => {
    return getNowInTimezone().toMillis();
  };

  // function to get the current time as 00:00 format
  const prettyPrintNowTime = () => {
    return getNowInTimezone().toFormat("HH:mm");
  };

  // function to get the next 15 min slot as 00:00 format
  const prettyPrintNextTime = () => {
    return getNext15MinSlot().toFormat("HH:mm");
  }


  const formattedSidebarData: {
    timestamp: number;
    solar_generation?: number;
    wind_generation?: number;
    solar_forecast_past?: number;
    solar_forecast_future?: number;
    wind_forecast_past?: number;
    wind_forecast_future?: number;
  }[] = [];

  // Loop through wind generation and add to formattedSidebarData
  if (windForecastData?.values) {
    for (const value of windForecastData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedSidebarData?.find(
        (data) => data.timestamp === timestamp
      );
      const key =
        timestamp < getEpochNowInTimezone()
          ? "wind_forecast_past"
          : "wind_forecast_future";
      if (existingData) {
        existingData[key] = value.PowerKW / 1000;
      } else {
        formattedSidebarData?.push({
          timestamp,
          [key]: value.PowerKW / 1000,
        });
      }
    }
  }
  

  // // Loop through solar generation and add to formattedSolarData
  if (windGenerationData?.values) {
    for (const value of windGenerationData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedSidebarData?.find(
        (data) => data.timestamp === timestamp
      );
      if (existingData) {
        existingData.wind_generation = value.PowerKW / 1000;
      } else {
        formattedSidebarData?.push({
          timestamp,
          wind_generation: value.PowerKW / 1000,
        });
      }
    }
  }
  // // Loop through solar forecast and add to formattedSolarData
  // if (solarForecastData?.values) {
  //   for (const value of solarForecastData?.values) {
  //     const timestamp = convertDatestampToEpoch(value.Time);
  //     const existingData = formattedSidebarData?.find(
  //       (data) => data.timestamp === timestamp
  //     );
  //     if (existingData) {
  //       existingData.solar_forecast = value.PowerKW / 1000;
  //     } else {
  //       formattedSidebarData?.push({
  //         timestamp,
  //         solar_forecast: value.PowerKW / 1000,
  //       });
  //     }
  //   }
  // }
  // // Loop through solar generation and add to formattedSolarData
  // if (solarGenerationData?.values) {
  //   for (const value of solarGenerationData?.values) {
  //     const timestamp = convertDatestampToEpoch(value.Time);
  //     const existingData = formattedSidebarData?.find(
  //       (data) => data.timestamp === timestamp
  //     );
  //     if (
  //       existingData &&
  //       (existingData.solar_forecast || existingData.wind_forecast)
  //     ) {
  //       existingData.solar_generation = value.PowerKW / 1000;
  //     }
  //   }
  // }
  const formattedGenerationData = formattedSidebarData.sort(
    (a, b) => b.timestamp - a.timestamp
  );

  
  let actualWindGeneration =
    formattedGenerationData[0]?.wind_generation?.toFixed(2) || 0;
  actualWindGeneration = Number(
    Number(actualWindGeneration) / 1000
  ).toFixed(2);

  let currentWindForecast =
    formattedGenerationData[0]?.wind_forecast.toFixed(2) || 0;
  currentWindForecast = Number(Number(currentWindForecast) / 1000).toFixed(2);
  let nextWindForecast =
    formattedGenerationData[1]?.wind_forecast?.toFixed(2) || 0;
  nextWindForecast = Number(Number(nextWindForecast) / 1000).toFixed(2);

  let actualSolarGeneration =
    formattedGenerationData[0]?.solar_generation?.toFixed(2) || 0;
  actualSolarGeneration = Number(Number(actualSolarGeneration) / 1000).toFixed(
    2
  );

  let currentSolarForecast =
    formattedGenerationData[0]?.solar_forecast?.toFixed(2) || 0;
  currentSolarForecast = Number(Number(currentSolarForecast) / 1000).toFixed(2);

  let nextSolarForecast =
    formattedGenerationData[1]?.solar_forecast?.toFixed(2) || 0;
  nextSolarForecast = Number(Number(nextSolarForecast) / 1000).toFixed(2);

  const actualPowerGeneration =
    Number(actualWindGeneration+ 0).toFixed(2) || 0;
  const currentPowerForecast = Number(currentWindForecast + 0).toFixed(2) || 0;
  const nextPowerForecast = Number(nextWindForecast + 0).toFixed(2) || 0;

  console.log("latestActualWindGeneration", actualSolarGeneration);

  console.log("sidebarformattedGenerationData", formattedSidebarData);

  console.log(
    "formattedSidebarData",
    formattedSidebarData.map((d) => ({
      prettyPrint: new Date(d.timestamp).toLocaleString(),
      ...d,
    }))
  );


  console.log("nextDate", prettyPrintNextTime());
  console.log("nowDate", prettyPrintNowTime());

  if (solarGenerationData?.values) {
    for (const value of solarGenerationData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedSidebarData?.find(
        (data) => data.timestamp === timestamp
      );
      if (existingData &&
    existingData.solar_forecast ) {
        existingData.solar_generation = value.PowerKW / 1000;
      } else {
        formattedSidebarData?.push({
          timestamp,
          solar_generation: value.PowerKW / 1000,
        });
      }
    }
  }
  if (solarForecastData?.values) {
    for (const value of solarForecastData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedSidebarData?.find(
        (data) => data.timestamp === timestamp
      );
      if (existingData) {
        existingData.solar_forecast = value.PowerKW / 1000;
      } else {
        formattedSidebarData?.push({
          timestamp,
          solar_forecast: value.PowerKW / 1000,
        });
      }
    }
  }

  console.log("sidebarformattedGenerationData", formattedSidebarData);

  let [expanded, setExpanded] = useState(true);
  function handleClick() {
    setExpanded(!expanded);
  }
  if (expanded) {
    return (
      <div className="flex-0 w-96 justify-center items-center bg-444444">
        <div className="w-full h-full p-4 bg-neutral-700 flex-col justify-start items-start gap-5 inline-flex">
          <div className="justify-start items-start gap-[110px] flex-col">
            <div className="flex justify-between">
              <div className="text-white text-lg font-bold font-sans leading-normal">
                {title}
              </div>
              <button className="w-8 h-8 relative" onClick={handleClick}>
                <ChevronLeft />
              </button>
            </div>

            <div className="self-stretch h-[465px] flex-col justify-start items-start gap-4 flex">
              {/* start card */}
              <WideCard
                icon={<PowerIcon />}
                actualGeneration={actualPowerGeneration}
                currentForecast={currentPowerForecast}
                nextForecast={nextPowerForecast}
                energyTag="Power"
                bgTheme="bg-quartz-energy-100"
                textTheme="text-quartz-energy-100"
              />
              {/* end card */}
              <div className="w-[350px] h-px border border-white border-opacity-40"></div>
              <div className="self-stretch h-[39px] justify-start items-start gap-4 inline-flex">
                <ForecastTimeDisplay
                  time={prettyPrintNowTime()}
                  icon={<ClockIcon />}
                  forecastTag="NOW GW"
                />
                <ForecastTimeDisplay
                  time={prettyPrintNextTime()}
                  icon={<ClockIcon />}
                  forecastTag="NEXT GW"
                />
              </div>
              <WideCard
                icon={<WindIcon />}
                actualGeneration={actualWindGeneration.toString()}
                currentForecast={currentWindForecast}
                nextForecast={nextWindForecast}
                energyTag="Wind"
                textTheme="text-quartz-energy-200"
                bgTheme="bg-quartz-energy-200"
              />
              <div className="w-[350px] h-px border border-white border-opacity-40"></div>
              <WideCard
                icon={<SolarIcon />}
                actualGeneration={actualSolarGeneration}
                currentForecast={currentSolarForecast}
                nextForecast={nextSolarForecast}
                energyTag="Solar"
                textTheme="text-quartz-energy-300"
                bgTheme="bg-quartz-energy-300"
              />
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="flex-0 justify-center items-center bg-444444">
        <div className="w-14 h-full px-2 py-4 bg-neutral-700 flex-col justify-start items-center gap-5 inline-flex">
          <div className="justify-start items-start gap-[110px] inline-flex ">
            <button
              className="w-6 h-6 relative rounded-lg"
              onClick={handleClick}
            >
              <HamburgerMenu />
            </button>
          </div>
          <div className="self-stretch h-[354px] flex-col justify-start items-start gap-4 flex">
            <MiniCard
              icon={<PowerIcon />}
              textTheme={"text-quartz-energy-100"}
              bgTheme={"bg-quartz-energy-100"}
              actualGeneration={actualPowerGeneration}
              nextForecast={nextPowerForecast}
            />
            <div className="w-full h-px mt-4 border border-white border-opacity-40"></div>
            <MiniCard
              icon={<WindIcon />}
              textTheme={"text-quartz-energy-200"}
              bgTheme={"bg-quartz-energy-200"}
              actualGeneration={actualWindGeneration}
              nextForecast={nextWindForecast}
            />
            <div className="w-full h-px mt-4 border border-white border-opacity-40"></div>
            <MiniCard
              icon={<SolarIcon />}
              textTheme={"text-quartz-energy-300"}
              bgTheme={"bg-quartz-energy-300"}
              actualGeneration={actualSolarGeneration}
              nextForecast={nextSolarForecast}
            />
          </div>
        </div>
      </div>
    );
  }
};

export default Sidebar;
