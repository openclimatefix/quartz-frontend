import React from "react";
import {
  ThinUpArrow,
  ThinDownArrow,
  UpArrow,
  DownArrow,
  SitesDownArrow,
  SitesUpArrow
} from "../../icons/icons";
import { CombinedSitesData, SitesPvActual, SitesPvForecast, Site, AllSites } from "../../types";
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



const TableHeader: React.FC<{ text: string }> = ({ text }) => {
  return (
        <div
          className="sticky flex flex-row bg-ocf-sites-100
            justify-between"
        >
          <div className="ml-10 w-80">
            <div className="py-3 font-bold text-sm ">
              <p>{text}</p>
            </div>
          </div>
          <div className="flex flex-row">
            <div className="text-white w-32
                         justify-start py-3 pr-10 font-bold flex flex-row text-sm">
              <p>Capacity</p>
            </div>
            <div className="flex text-white font-bold w-32 justify-start py-3 pr-10 text-sm">
              <p>MW</p>
            </div>
          </div>
        </div>)
}
// Tables will show Capacity => This should be the forecast as % yield if we don't have truth value in the past. 
//Tables will also show generation MW value over installed capacity. If we have truths, use truths, if we have forecast, use forecast given a specific time. 

type TableDataProps = {
  dno?: string,
  gsp?: string,
  actualGeneration?: string,
  forecast?: string,
  installedCapacity?: string,
  text?: string
  site_uuid?: string
  normalizedValue?: string
  sitesData: Map<number, Site>
  aggregationLevel?: string
  level?: string
}

const TableData: React.FC<TableDataProps> = ({ sitesData, level, text, installedCapacity, normalizedValue}) => {
  const [aggregationLevel] = useGlobalState("aggregationLevel")
  
  if (!sitesData) {
    return (
      <div>
        There is currently no data. 
      </div>
    )
  }

  const sitesArray = Array.from(sitesData.values())
  
  return (
    <>
    <div className="h-52 overflow-y-scroll">
        {sitesArray?.map((site) => {
        
          if (aggregationLevel === "REGION") {
            const obj = JSON.parse(site.dno)
            level = obj.long_name
          } else if (aggregationLevel === "GSP") {
            const obj = JSON.parse(site.gsp)
            level = `${obj.name} - ${obj.gsp_id}`
          } else if (aggregationLevel==="SITE") {
            level = site.client_site_id
          } else {
            const obj = JSON.parse(site.dno)
            level = `${obj.long_name} - ${obj.dno_id}`
            }
          return (
            <>
              <div key={site.site_uuid} className="flex flex-col bg-ocf-delta-950">
                <div className="flex flex-row justify-between text-sm">
                  <div className="ml-10 w-80">
                    <div className="py-3 text-white font-bold text-sm">
                      {level}
                    </div>
                  </div> 
                  <div className="flex flex-row">
                    <div
                      className="text-white w-32
                         justify-center py-3 pr-10 font-bold flex flex-row text-sm"
                    >
                      <p>
                        {normalizedValue}
                        <span className="ocf-gray-400 text-xs">%</span>
                      </p>
                    </div>
                    <div className="flex text-white font-bold w-32 justify-center py-3 pr-10 text-sm">
                     {site.installed_capacity_kw.toFixed(2)}
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
        </>)}
        


export const RegionTable: React.FC<{
  className: string;
  allSites: Map<number,Site>;
  sitesPvActual: SitesPvActual[];
  sitesPvForecast: SitesPvForecast[];
  sitesCombinedData?: CombinedSitesData[];
  dno: string
}> = ({ className, allSites, dno, sitesCombinedData, sitesPvActual, sitesPvForecast }) => {
 
  return (
  
    <>
      <div className={`${className || ""}`}>
     <TableHeader text={"Region"}/>
        <TableData
          sitesData={allSites}
          normalizedValue={"50"}
         />
        </div>
    </>
  );
};

export const GSPTable: React.FC<{
  allSites: Map<number,Site>;
  sitesPvActual: SitesPvActual[];
  sitesPvForecast: SitesPvForecast[];
  sitesCombinedData?: CombinedSitesData[];
  className: string
}> = ({
  sitesCombinedData,
  allSites,
  className
}) => {
  // const gsp = allSites[0].gsp
  // const installedCapacity = allSites[0].installed_capacity_kw.toFixed(2)
  return (
    <>
      <div className={`${className || ""}`}>
     <TableHeader text={"Grid Supply Point"}/>
        <TableData
          sitesData={allSites}
          normalizedValue={"50"}
        />
        </div>
     </>
  );
};

export const SiteTable: React.FC<{ className: string; allSites: Map<number,Site>;  sitesCombinedData?: CombinedSitesData;}> = ({
  allSites,
  sitesCombinedData,
  className
}) => {
  return (
    <>
      <div className={`${className || ""}`}>
        <TableHeader text={"Site"} />
        <TableData
          sitesData={allSites}
        />
        </div>
    </>
  );
}
