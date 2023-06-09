import React from "react";
import {
  ThinUpArrow,
  ThinDownArrow,
  UpArrow,
  DownArrow,
  SitesDownArrow,
  SitesUpArrow
} from "../../icons/icons";
import { Site } from "../../types";
import useGlobalState from "../../helpers/globalState";

const sites = [
  {
    dno: "East England",
    percentage: "25",
    installedCapacity: "340",
    actualGeneration: "285",
    delta: -59
  },
  { dno: "East Midlands", percentage: "25", installedCapacity: "340", delta: -56 },
  { dno: "London", percentage: "96", installedCapacity: "85", actualGeneration: "52", delta: 89 },
  {
    dno: "13	North Wales, Merseyside and Cheshire",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "	West Midlands",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "North East England",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "North West England",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "Sought and Central Scotland",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "South East England",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "South Wales",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "SouthWest England",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  { dno: "Yorkshire", percentage: "27", installedCapacity: "85", actualGeneration: "52", delta: 89 }
];
//Table for GSPs
// Table for Sites
// get data for the table
const SitesTable: React.FC<Site> = ({ dno, region, installed_capacity_kw }) => {
  let size = 17;
  return (
    <>
      <div className="">
        <div
          className="sticky flex flex-row bg-ocf-sites-100
            justify-between"
        >
          <div>
            <div className="ml-10 w-80">
              <div className="py-3 font-bold text-sm ">
                <p>DNO</p>
              </div>
            </div>
          </div>
          <div>
            <div className="flex flex-row justify-end ">
              <div className="w-32 py-3 flex justify-start font-bold text-sm">
                <p>Capacity</p>
              </div>
              <div className="w-32 py-3 flex justify-start font-bold text-sm">
                <p>Delta</p>
              </div>
              <div className="w-32 py-3 text-sm font-bold flex flex-row">
                <p>MW</p>
                <span className="pl-2 pb-1 font-bold">
                  <ThinUpArrow />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="h-52 overflow-y-scroll">
          {sites.slice(0, size).map((item) => {
            return (
              <>
                <div key={item.dno} className="flex flex-col bg-ocf-delta-950 ">
                  <div className="flex flex-row justify-between text-sm">
                    <div className="ml-10 w-80">
                      <div className="py-3 text-white font-bold text-sm">{item.dno}</div>
                    </div>

                    <div className="flex flex-row">
                      <div
                        className="text-white w-32
                         justify-center py-3 font-bold flex flex-row text-sm"
                      >
                        <p>
                          {item.percentage}
                          <span className="ocf-gray-400 text-xs">%</span>
                        </p>
                        <span className="pl-2">
                          <ThinDownArrow />
                        </span>
                      </div>
                      <div className="flex flex-row text-white justify-start w-32 py-3 font-bold text-sm">
                        <span className="fill-white pr-1">
                          {item.delta > 0 ? <SitesUpArrow /> : <SitesDownArrow />}
                        </span>
                        <p>{item.delta}</p>
                        <span className="text-ocf-gray-400 text-xs font-thin pt-1 ">MW</span>
                      </div>
                      <div className="flex text-white font-bold w-32 justify-center py-3 pr-10 text-sm">
                        {item.actualGeneration}/{item.installedCapacity}
                        <span className="text-ocf-gray-400 text-xs font-thin pt-1">MW</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-end justify-end flex-row-reverse bg-ocf-delta-950 mb-0.5">
                  <div className="bg-ocf-yellow h-2.5" style={{ width: `2px` }}></div>
                  <div className="bg-ocf-yellow h-1" style={{ width: `${item.percentage}%` }}></div>
                </div>
              </>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default SitesTable;
