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
import useGlobalState, { useCountryState } from "../../helpers/globalState";
import useFormatChartDataSites from "../use-format-chart-data-sites";
import { SORT_BY } from "../../../constant";
import { Dispatch, SetStateAction } from "react";
import { ChartData } from "../remix-line";
import { formatISODateString } from "../../helpers/utils";

const TableHeader: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div
      className="sticky top-0 z-10 flex flex-row bg-surface-raised
            justify-between"
    >
      <div className="ml-10 w-80">
        <div className="py-3 font-bold text-sm ">
          <p>{text}</p>
        </div>
      </div>
      <div className="flex flex-row">
        <div
          className="text-content w-32
                         justify-start py-3 pr-10 font-bold flex flex-row text-sm"
        >
          <p>Capacity</p>
        </div>
        <div className="flex text-content font-bold w-32 justify-start py-3 pr-10 text-sm">
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
  const [clickedSiteGroupId, setClickedSiteGroupId] = useCountryState("clickedSiteGroupId");
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

  const unselectedSiteClass = `transition duration-200 ease-out hover:ease-in hover:bg-content-muted cursor-pointer`;

  const selectedSiteClass = `bg-surface-panel cursor-pointer`;

  return (
    <>
      <div className="flex-1">
        {rows?.sort(sortFn).map((site) => {
          const mostAccurateGeneration = site.actualPV || site.expectedPV;
          return (
            <React.Fragment key={`site-row-${site.id}`}>
              <div
                className={`${
                  clickedSiteGroupId === site.id
                    ? "bg-surface-panel text"
                    : "bg-ocf-delta-950 transition duration-200 ease-out hover:bg-content-muted hover:ease-in"
                } mb-0.5 bg-ocf-delta-950 cursor-pointer relative  w-full 
            `}
                onClick={() => setClickedSiteGroupId(site.id)}
              >
                <div key={site.label} className={`flex flex-col`}>
                  <div className="flex flex-row justify-between text-sm">
                    <div className="ml-10 w-80">
                      <div className="py-3 text-content font-bold text-sm">{site.label}</div>
                    </div>
                    <div className="flex flex-row">
                      <div
                        className="text-content w-32
                         justify-center py-3 pr-10 font-bold flex flex-row text-sm"
                      >
                        <p>
                          <span className={!!site.actualPV ? "text-content" : "text-solar"}>
                            {Number(site.aggregatedYield).toFixed()}
                          </span>
                          <span className="text-content text-xs">%</span>
                        </p>
                      </div>
                      <div className="flex text-content font-bold w-32 justify-center py-3 pr-10 text-sm">
                        <span className={`pr-1${site.actualPV ? "" : " text-solar"}`}>
                          {Number(mostAccurateGeneration).toFixed(
                            mostAccurateGeneration < 10 ? 1 : 0
                          )}
                        </span>{" "}
                        / {Number(site.capacity).toFixed()}
                        <span className="text-content text-xs font-thin pt-1 pl-0.5">KW</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="absolute bottom-0 flex items-end justify-end flex-row-reverse w-full
               "
                >
                  <div
                    className={`${clickedSiteGroupId === site.id ? "h-2" : "h-2"} bg-solar`}
                    style={{ width: `3px` }}
                  ></div>
                  <div
                    className={`h-1 bg-solar`}
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
