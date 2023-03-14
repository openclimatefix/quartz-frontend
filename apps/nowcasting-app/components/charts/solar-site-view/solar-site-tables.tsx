import React from "react";
import {
  ThinUpArrow,
  ThinDownArrow,
  UpArrow,
  DownArrow,
  SitesDownArrow,
  SitesUpArrow
} from "../../icons/icons";
import { CombinedSitesData, SitesPvActual, SitesPvForecast, Site } from "../../types";
import useGlobalState from "../../helpers/globalState";
import useFormatChartDataSites from "../use-format-chart-data-sites";
import { AGGREGATION_LEVELS } from "../../../constant";
import { Dispatch, SetStateAction } from "react";

const sites = [
  {
    dno: "East England-10",
    percentage: "25",
    installedCapacity: "340",
    actualGeneration: "285",
    delta: -59
  },
  { dno: "East Midlands-11", percentage: "25", installedCapacity: "340", delta: -56 },
  {
    dno: "London-12",
    percentage: "96",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "North Wales, Merseyside and Cheshire-13",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "West Midlands-14",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "North East England-15",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "North West England-16",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "North Scotland-16",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "Sought and Central Scotland-18",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "South East England-19",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "Southern England-20",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "South Wales-21",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "South West England-22",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  },
  {
    dno: "Yorkshire-23",
    percentage: "27",
    installedCapacity: "85",
    actualGeneration: "52",
    delta: 89
  }
];

export const RegionTable: React.FC<{
  className: string;
  allSites: Site[];
  sitesPvActual: SitesPvActual[];
  sitesPvForecast: SitesPvForecast[];
  sitesCombinedData?: CombinedSitesData[];
}> = ({ className, allSites, sitesCombinedData, sitesPvActual, sitesPvForecast }) => {
  let size = 17;
  const [zoom] = useGlobalState("zoom");

  return (
    <>
      <div className={`flex flex-col flex-1 mb-1 ${className || ""}`}>
        <div
          className="sticky flex flex-row bg-ocf-sites-100
            justify-between"
        >
          <div className="ml-10 w-80">
            <div className="py-3 font-bold text-sm ">
              <p>Region</p>
            </div>
          </div>

          <div className="flex flex-row justify-end">
            <div className="w-32 py-3 flex justify-start font-bold text-sm">
              <p>Capacity</p>
            </div>
            <div>
              <p>MW</p>
              <span className="pl-2 pb-1 font-bold">
                <ThinUpArrow />
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-52 overflow-y-scroll">
        {allSites?.map((site) => {
          return (
            <>
              <div key={site.site_uuid} className="flex flex-col bg-ocf-delta-950">
                <div className="flex flex-row justify-between text-sm">
                  <div className="ml-10 w-80">
                    <div className="py-3 text-white font-bold text-sm">
                      {site.site_uuid === null ? "No DNO name" : site.dno}
                    </div>
                  </div>
                  <div className="flex flex-row">
                    <div
                      className="text-white w-32
                         justify-center py-3 font-bold flex flex-row text-sm"
                    >
                      <p>
                        {site.installed_capacity_kw.toFixed()}
                        <span className="ocf-gray-400 text-xs">%</span>
                      </p>
                    </div>
                    <div className="flex text-white font-bold w-32 justify-center py-3 pr-10 text-sm">
                      {site.installed_capacity_kw}/{site.installed_capacity_kw}
                      <span className="text-ocf-gray-400 text-xs font-thin pt-1">MW</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-end justify-end flex-row-reverse bg-ocf-delta-950 mb-0.5">
                <div className="bg-ocf-yellow h-2.5" style={{ width: `2px` }}></div>
                <div className="bg-ocf-yellow h-1" style={{ width: `${50}%` }}></div>
              </div>
            </>
          );
        })}
      </div>
    </>
  );
};

export const GSPTable: React.FC<{ className: string; sitesCombinedData?: CombinedSitesData }> = ({
  sitesCombinedData,
  className
}) => {
  return (
    <div className={`flex flex-col flex-1 mb-1 ${className || ""}`}>This is the GSP Site Table</div>
  );
};

export const SiteTable: React.FC<{ className: string; sitesCombinedData?: CombinedSitesData }> = ({
  sitesCombinedData,
  className
}) => {
  return (
    <div className={`flex flex-col flex-1 mb-1 ${className || ""}`}>This is the Site Table</div>
  );
};
