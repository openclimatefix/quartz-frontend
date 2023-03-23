import React from "react";
import { useEffect } from "react";
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
import { convertISODateStringToLondonTime } from "../../helpers/utils";
import { ChartData } from "../remix-line";
import { consoleSandbox } from "@sentry/utils";
import { formatISODateString } from "../../helpers/utils";

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
        <div
          className="text-white w-32
                         justify-start py-3 pr-10 font-bold flex flex-row text-sm"
        >
          <p>Capacity</p>
        </div>
        <div className="flex text-white font-bold w-32 justify-start py-3 pr-10 text-sm">
          <p>MW</p>
        </div>
      </div>
    </div>
  );
};
// Tables will show Capacity => This should be the forecast as % yield if we don't have truth value in the past.
//Tables will also show generation MW value over installed capacity. If we have truths, use truths, if we have forecast, use forecast given a specific time.

type TableDataProps = {
  aggregationLabel?: string;
  aggregatedCapacity?: string;
  aggregatedActualPV?: string;
  aggregatedExpectedPV?: string;
  site_uuid?: string;
  sitesData: CombinedSitesData;
};

const TableData: React.FC<TableDataProps> = ({
  sitesData,
  aggregationLabel,
  aggregatedCapacity,
  aggregatedActualPV,
  aggregatedExpectedPV
}) => {
  const [aggregationLevel] = useGlobalState("aggregationLevel");
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  console.log(selectedISOTime);

  // site level
  const getExpectedPowerGenerationForSite = (site_uuid: string, targetTime: string) => {
    const siteForecast = sitesData.sitesPvForecastData.find((fc) => fc.site_uuid === site_uuid);
    return (
      siteForecast?.forecast_values.find(
        (fv) => formatISODateString(fv.target_datetime_utc) === formatISODateString(targetTime)
      )?.expected_generation_kw || 0
    );
  };

  const getExpectedPowerGenerationNational = (site_uuid: string, targetTime: string) => {
    const siteForecast = sitesData.sitesPvForecastData.find((fc) => fc.site_uuid === site_uuid);
    return (
      siteForecast?.forecast_values.find(
        (fv) => formatISODateString(fv.target_datetime_utc) === formatISODateString(targetTime)
      )?.expected_generation_kw || 0
    );
  };

  const getPvActualGenerationForSite = (site_uuid: string, targetTime: string) => {
    const siteForecast = sitesData.sitesPvActualData.find((pv) => pv.site_uuid === site_uuid);
    return (
      siteForecast?.pv_actual_values.find(
        (pv) => formatISODateString(pv.datetime_utc) === formatISODateString(targetTime)
      )?.actual_generation_kw || 0
    );
  };

  const getPvActualGenerationNational = (site_uuid: string, targetTime: string) => {
    const siteGeneration = sitesData.sitesPvActualData.find((pv) => pv.site_uuid === site_uuid);
    const siteGenerationArray = [];
    const siteGenerationValue =
      siteGeneration?.pv_actual_values.find(
        (pv) => formatISODateString(pv.datetime_utc) === formatISODateString(targetTime)
      )?.actual_generation_kw || 0;
    siteGenerationArray.push(siteGenerationValue);
    console.log("site", siteGenerationArray);
    const cumulativePV = siteGenerationArray.reduce((acc, site) => acc + site, 0);
    return cumulativePV;
  };

  return (
    <>
      <div className="h-52 overflow-y-scroll">
        {sitesData.allSitesData.map((site) => {
          const expectedPowerGeneration = getExpectedPowerGenerationForSite(
            site.site_uuid,
            selectedISOTime || new Date().toISOString()
          );

          const actualPowerGeneration = getPvActualGenerationForSite(
            site.site_uuid,
            selectedISOTime || new Date().toISOString()
          );

          const actualPowerGenerationNational = getPvActualGenerationNational(
            site.site_uuid,
            selectedISOTime || new Date().toISOString()
          );

          console.log(actualPowerGenerationNational);

          if (aggregationLevel === "NATIONAL") {
            aggregationLabel = "National";
            aggregatedCapacity = cumulativeCapacityNational.toFixed(2);
            aggregatedActualPV = actualPowerGenerationNational.toFixed(2);
            // aggregatedExpected = expectedPowerGenerationNational.toFixed(2)
            // arrayToMap = ["National"]
          } else if (aggregationLevel === "REGION") {
            const obj = JSON.parse(site.dno);
            aggregationLabel = obj.long_name;
          } else if (aggregationLevel === "GSP") {
            const obj = JSON.parse(site.gsp);
            aggregationLabel = `${obj.name} - ${obj.gsp_id}`;
          } else if (aggregationLevel === "SITE") {
            aggregationLabel = site.client_site_id;
          } else {
            const obj = JSON.parse(site.dno);
            aggregationLabel = `${obj.long_name} - ${obj.dno_id}`;
          }
          return (
            <>
              <div key={site.site_uuid} className="flex flex-col bg-ocf-delta-950">
                <div className="flex flex-row justify-between text-sm">
                  <div className="ml-10 w-80">
                    <div className="py-3 text-white font-bold text-sm">{aggregationLabel}</div>
                  </div>
                  <div className="flex flex-row">
                    <div
                      className="text-white w-32
                         justify-center py-3 pr-10 font-bold flex flex-row text-sm"
                    >
                      <p>
                        {aggregatedExpectedPV ? aggregatedExpectedPV : aggregatedActual}
                        <span className="ocf-gray-400 text-xs">%</span>
                      </p>
                    </div>
                    <div className="flex text-white font-bold w-32 justify-center py-3 pr-10 text-sm">
                      {aggregatedActual} /{aggregatedCapacity}
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

export const NationalTable: React.FC<{
  className: string;
  allSites: Map<number, Site>;
  sitesPvActual?: SitesPvActual[];
  sitesPvForecast?: SitesPvForecast[];
  sitesCombinedData: CombinedSitesData;
}> = ({ className, allSites, sitesCombinedData }) => {
  const cumulativeCapacityNational = sitesCombinedData.allSitesData?.reduce(
    (acc, site) => acc + site.installed_capacity_kw,
    0
  );
  // const cumulativeGenerationNational = sitesCombinedData.sitesPvActualData?.reduce((acc, site) => acc + site.pv_actual_values, 0)

  // const cumulativeExpectedGenerationNational = sitesCombinedData.sitesPvForecastData?.forEach(site => site.find(pv(acc, pv)=> acc + site.forecast_values))
  return (
    <>
      <div className={`${className || ""}`}>
        <TableHeader text={"National"} />
        <TableData
          sitesData={["National"]}
          aggregationLabel={"National"}
          aggregatedCapacity={cumulativeCapacityNational.toFixed(2)}
          aggregatedPercentCapacity={cumulativePercentCapacityNational.toFixed(2)}
        />
      </div>
    </>
  );
};

export const RegionTable: React.FC<{
  className: string;
  allSites: Map<number, Site>;
  sitesPvActual?: SitesPvActual[];
  sitesPvForecast?: SitesPvForecast[];
  sitesCombinedData?: CombinedSitesData;
  dno: string;
}> = ({ className, allSites, sitesCombinedData }) => {
  return (
    <>
      <div className={`${className || ""}`}>
        <TableHeader text={"Region"} />
        <TableData sitesData={sitesCombinedData} />
      </div>
    </>
  );
};

export const GSPTable: React.FC<{
  allSites: Map<number, Site>;
  sitesPvActual: SitesPvActual[];
  sitesPvForecast: SitesPvForecast[];
  sitesCombinedData?: CombinedSitesData;
  data: ChartData[];
  className: string;
}> = ({ sitesCombinedData, allSites, className, data }) => {
  return (
    <>
      <div className={`${className || ""}`}>
        <TableHeader text={"Grid Supply Point"} />
        <TableData sitesData={sitesCombinedData} normalizedValue={"50"} />
      </div>
    </>
  );
};

export const SiteTable: React.FC<{
  className: string;
  allSites: Map<number, Site>;
  sitesCombinedData: CombinedSitesData;
}> = ({ allSites, sitesCombinedData, className }) => {
  return (
    <>
      <div className={`${className || ""}`}>
        <TableHeader text={"Site"} />
        <TableData sitesData={sitesCombinedData} />
      </div>
    </>
  );
};
