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
import {
  CombinedSitesData,
  SitesPvActual,
  SitesPvForecast,
  Site,
  AllSites,
  AggregatedSitesDatum,
  AggregatedSitesDataGroupMap
} from "../../types";
import useGlobalState from "../../helpers/globalState";
import useFormatChartDataSites from "../use-format-chart-data-sites";
import { SORT_BY } from "../../../constant";
import { Dispatch, SetStateAction } from "react";
import { convertISODateStringToLondonTime } from "../../helpers/utils";
import { ChartData } from "../remix-line";
import { consoleSandbox } from "@sentry/utils";
import { formatISODateString } from "../../helpers/utils";

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
          <p>KW</p>
        </div>
      </div>
    </div>
  );
};
// Tables will show Capacity => This should be the forecast as % yield if we don't have truth value in the past.
//Tables will also show generation MW value over installed capacity. If we have truths, use truths, if we have forecast, use forecast given a specific time.

type TableDataProps = {
  rows: AggregatedSitesDatum[];
};

const TableData: React.FC<TableDataProps> = ({ rows }) => {
  const [sortBy, setSortBy] = useGlobalState("sortBy");
  const [clickedSiteGroupId, setClickedSiteGroupId] = useGlobalState("clickedSiteGroupId");
  const sortFn = (a: any, b: any) => {
    if (sortBy === SORT_BY.CAPACITY) {
      return b.capacity - a.capacity;
    } else if (sortBy === SORT_BY.GENERATION) {
      if (a.actualPV && b.actualPV) {
        return b.actualPV - a.actualPV;
      }
      return b.expectedPV - a.expectedPV;
    } else if (sortBy === SORT_BY.YIELD) {
      return b.aggregatedYield - a.aggregatedYield;
    }
    return b.label - a.label;
  };

  const unselectedSiteClass = `transition duration-200 ease-out hover:ease-in hover:bg-ocf-gray-700 cursor-pointer`;

  const selectedSiteClass = `bg-ocf-gray-800 cursor-pointer`;

  return (
    <>
      <div className="flex-1 h-72 overflow-y-scroll">
        {rows?.sort(sortFn).map((site) => {
          const mostAccurateGeneration = site.actualPV || site.expectedPV;
          return (
            <React.Fragment key={site.label}>
              <div
                className={`${
                  clickedSiteGroupId === site.id
                    ? "bg-ocf-gray-800 text"
                    : "bg-ocf-delta-950 transition duration-200 ease-out hover:bg-ocf-gray-700 hover:ease-in"
                } mb-0.5 bg-ocf-delta-950 cursor-pointer relative  w-full 
            `}
                onClick={() => setClickedSiteGroupId(site.id)}
              >
                <div key={site.label} className={`flex flex-col`}>
                  <div className="flex flex-row justify-between text-sm">
                    <div className="ml-10 w-80">
                      <div className="py-3 text-white font-bold text-sm">{site.label}</div>
                    </div>
                    <div className="flex flex-row">
                      <div
                        className="text-white w-32
                         justify-center py-3 pr-10 font-bold flex flex-row text-sm"
                      >
                        <p>
                          <span className={!!site.actualPV ? "text-white" : "text-ocf-yellow"}>
                            {Number(site.aggregatedYield).toFixed()}
                          </span>
                          <span className="ocf-gray-400 text-xs">%</span>
                        </p>
                      </div>
                      <div className="flex text-white font-bold w-32 justify-center py-3 pr-10 text-sm">
                        <span className={`pr-1${site.actualPV ? "" : " text-ocf-yellow"}`}>
                          {Number(mostAccurateGeneration).toFixed(
                            mostAccurateGeneration < 10 ? 1 : 0
                          )}
                        </span>{" "}
                        / {Number(site.capacity).toFixed()}
                        <span className="text-ocf-gray-400 text-xs font-thin pt-1 pl-0.5">KW</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="absolute bottom-0 flex items-end justify-end flex-row-reverse w-full
               "
                >
                  <div
                    className={`${
                      clickedSiteGroupId === site.id ? "h-2" : "h-2"
                    } bg-ocf-yellow-500`}
                    style={{ width: `3px` }}
                  ></div>
                  <div
                    className={`h-1 bg-ocf-yellow-500`}
                    style={{
                      width: `${Number(site.aggregatedYield).toFixed()}%`
                    }}
                  ></div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
};

export const AggregatedDataTable: React.FC<{
  className: string;
  title: string;
  tableData: AggregatedSitesDatum[];
}> = ({ className, title, tableData }) => {
  return (
    <>
      <div className={`flex-1 ${className || ""}`}>
        <TableHeader text={title} />
        <TableData rows={tableData} />
      </div>
    </>
  );
};
