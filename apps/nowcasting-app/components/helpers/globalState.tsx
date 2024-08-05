import { createGlobalState } from "react-hooks-global-state";
import { getDeltaBucketKeys, AGGREGATION_LEVELS, VIEWS, SORT_BY } from "../../constant";
import mapboxgl from "mapbox-gl";
import { enable4hView } from "./utils";
import {
  getArraySettingFromCookieStorage,
  getBooleanSettingFromLocalStorage,
  CookieStorageKeys
} from "./cookieStorage";
import { NationalEndpointStates, LoadingState, SitesEndpointStates } from "../types";
import { ChartData } from "../charts/remix-line";

export function get30MinNow(offsetMinutes = 0) {
  // this is a function to get the date of now, but rounded up to the closest 30 minutes
  let date = new Date();

  let minutes = date.getMinutes();
  if (offsetMinutes !== 0) {
    minutes += offsetMinutes;
    date.setMinutes(minutes);
  }
  date = getNext30MinSlot(date);
  return date.toISOString();
}
export function getNext30MinSlot(isoTime: Date) {
  if (isoTime.getMinutes() === 30) {
    isoTime.setHours(isoTime.getHours() + 1);
    isoTime.setMinutes(0, 0, 0); // Resets also seconds and milliseconds
  } else if (isoTime.getMinutes() < 30) {
    isoTime.setHours(isoTime.getHours());
    isoTime.setMinutes(30, 0, 0); // Resets also seconds and milliseconds
  } else {
    isoTime.setHours(isoTime.getHours() + 1);
    isoTime.setMinutes(0, 0, 0); // Resets also seconds and milliseconds
  }
  return isoTime;
}

export type GlobalStateType = {
  selectedISOTime: string;
  timeNow: string;
  intervals: any[];
  clickedGspId?: number;
  clickedSiteGroupId?: string;
  forecastCreationTime?: string;
  view: VIEWS;
  aggregationLevel: AGGREGATION_LEVELS;
  visibleLines: string[];
  selectedBuckets: string[];
  maps: mapboxgl.Map[];
  lng: number;
  lat: number;
  zoom: number;
  showSiteCount?: boolean;
  show4hView?: boolean;
  dashboardMode: boolean;
  sortBy: SORT_BY;
  autoZoom: boolean;
  globalChartIsZooming: boolean;
  globalChartIsZoomed: boolean;
  globalZoomArea: { x1: string; x2: string };
  loadingState: LoadingState<NationalEndpointStates>;
  sitesLoadingState: LoadingState<SitesEndpointStates>;
  nHourForecast: number;
};

export const { useGlobalState, getGlobalState, setGlobalState } =
  createGlobalState<GlobalStateType>({
    selectedISOTime: get30MinNow(),
    timeNow: get30MinNow(),
    intervals: [],
    clickedGspId: undefined,
    clickedSiteGroupId: undefined,
    forecastCreationTime: undefined,
    view: VIEWS.FORECAST,
    visibleLines: getArraySettingFromCookieStorage(CookieStorageKeys.VISIBLE_LINES) || [
      "GENERATION",
      "GENERATION_UPDATED",
      "FORECAST"
    ],
    selectedBuckets: getDeltaBucketKeys().filter((key) => key !== "ZERO"),
    maps: [],
    lng: -2.3175601,
    lat: 54.70534432,
    zoom: 5,
    autoZoom: false,
    globalChartIsZooming: false,
    globalChartIsZoomed: false,
    globalZoomArea: { x1: "", x2: "" },
    showSiteCount: undefined,
    aggregationLevel: AGGREGATION_LEVELS.REGION,
    sortBy: SORT_BY.CAPACITY,
    show4hView:
      (enable4hView && getBooleanSettingFromLocalStorage(CookieStorageKeys.FOUR_HOUR_VIEW)) || true,
    dashboardMode: getBooleanSettingFromLocalStorage(CookieStorageKeys.DASHBOARD_MODE),
    loadingState: {
      initialLoadComplete: false,
      showMessage: false,
      message: "Loading data"
    },
    sitesLoadingState: {
      initialLoadComplete: false,
      showMessage: false,
      message: "Loading data"
    },
    nHourForecast: 4
  });

export default useGlobalState;
