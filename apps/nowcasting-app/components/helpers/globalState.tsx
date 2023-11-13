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
  loadingState: LoadingState<NationalEndpointStates>;
  sitesLoadingState: LoadingState<SitesEndpointStates>;
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
      "FORECAST",
      "PAST_FORECAST"
    ],
    selectedBuckets: getDeltaBucketKeys().filter((key) => key !== "ZERO"),
    maps: [],
    lng: -2.3175601,
    lat: 54.70534432,
    zoom: 5,
    autoZoom: false,
    showSiteCount: undefined,
    aggregationLevel: AGGREGATION_LEVELS.NATIONAL,
    sortBy: SORT_BY.CAPACITY,
    show4hView: enable4hView && getBooleanSettingFromLocalStorage(CookieStorageKeys.FOUR_HOUR_VIEW),
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
    }
  });

export default useGlobalState;
