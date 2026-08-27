import { createGlobalState } from "react-hooks-global-state";
import {
  AGGREGATION_LEVELS,
  getDeltaBucketKeys,
  P_LEVEL_OPTIONS,
  SORT_BY,
  VIEWS
} from "../../constant";
import {
  CookieStorageKeys,
  getArraySettingFromCookieStorage,
  getBooleanSettingFromCookieStorage
} from "./cookieStorage";
import { LoadingState, NationalEndpointStates, SitesEndpointStates } from "../types";
import { ActiveUnit, NationalAggregation } from "../map/types";
import { DateTime } from "luxon";
import type { ChannelSelection } from "./satelliteLayer";

export function get30MinNow(offsetMinutes = 0) {
  // this is a function to get the date of now, but rounded up to the closest 30 minutes
  let date = DateTime.utc();

  let minutes: number = date.minute;
  if (offsetMinutes !== 0) {
    minutes += offsetMinutes;
    date = date.set({ minute: minutes });
  }
  const jsDate = getNext30MinSlot(date.toJSDate());
  const newDate = DateTime.fromJSDate(jsDate);
  return newDate.toUTC().toISO() as string;
}
export function get30MinSlot(isoTime: Date) {
  if (isoTime.getMinutes() === 30) {
    return isoTime;
  } else if (isoTime.getMinutes() === 0) {
    return isoTime;
  } else if (isoTime.getMinutes() < 30) {
    isoTime.setHours(isoTime.getHours());
    isoTime.setMinutes(30, 0, 0); // Resets also seconds and milliseconds
  } else {
    isoTime.setHours(isoTime.getHours() + 1);
    isoTime.setMinutes(0, 0, 0); // Resets also seconds and milliseconds
  }
  return isoTime;
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
  activeUnit: ActiveUnit;
  selectedISOTime: string;
  timeNow: string;
  intervals: any[];
  clickedGspId?: number | string;
  clickedMapRegionIds?: string[];
  selectedMapRegionIds?: string[];
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
  showNHourView?: boolean;
  showConstraints: boolean;
  dashboardMode: boolean;
  sortBy: SORT_BY;
  autoZoom: boolean;
  isPlaying: boolean;
  globalChartIsZooming: boolean;
  globalChartIsZoomed: boolean;
  globalZoomArea: { x1: string; x2: string };
  loadingState: LoadingState<NationalEndpointStates>;
  sitesLoadingState: LoadingState<SitesEndpointStates>;
  nHourForecast: number;
  nationalAggregationLevel: NationalAggregation;
  pLevels: [number, number][];
  showCloudLayer: boolean;
  activeChannel: ChannelSelection;
  showPvLayer: boolean;
  trialExpiredAt: string;
};

const DEFAULT_P_LEVELS: [number, number][] = [[10, 90]];

// Drop any stored p-level pair that's no longer in P_LEVEL_OPTIONS, so a stale cookie from
// before the available p-levels changed can't select a pair the rest of the app doesn't know about.
const getValidatedPLevels = (): [number, number][] => {
  const stored = getArraySettingFromCookieStorage<[number, number]>(CookieStorageKeys.P_LEVELS);
  const validStored = stored?.filter(([lower, upper]) =>
    P_LEVEL_OPTIONS.some(([l, u]) => l === lower && u === upper)
  );
  return validStored?.length ? validStored : DEFAULT_P_LEVELS;
};

export const { useGlobalState, getGlobalState, setGlobalState } =
  createGlobalState<GlobalStateType>({
    activeUnit: ActiveUnit.percentage,
    selectedISOTime: get30MinNow(),
    timeNow: get30MinNow(),
    intervals: [],
    clickedGspId: undefined,
    clickedMapRegionIds: undefined,
    selectedMapRegionIds: undefined,
    clickedSiteGroupId: undefined,
    forecastCreationTime: undefined,
    view: VIEWS.FORECAST,
    visibleLines: getArraySettingFromCookieStorage(CookieStorageKeys.VISIBLE_LINES) || [
      "GENERATION",
      "GENERATION_UPDATED",
      "FORECAST",
      "N_HOUR_FORECAST",
      "SEASONAL_MEAN"
    ],
    selectedBuckets: getDeltaBucketKeys().filter((key) => key !== "ZERO"),
    maps: [],
    lng: -2.3175601,
    lat: 54.70534432,
    zoom: 5,
    autoZoom: true,
    isPlaying: false,
    globalChartIsZooming: false,
    globalChartIsZoomed: false,
    globalZoomArea: { x1: "", x2: "" },
    showSiteCount: undefined,
    aggregationLevel: AGGREGATION_LEVELS.NATIONAL,
    sortBy: SORT_BY.CAPACITY,
    showNHourView: getBooleanSettingFromCookieStorage(CookieStorageKeys.N_HOUR_VIEW, true),
    showConstraints: getBooleanSettingFromCookieStorage(CookieStorageKeys.CONSTRAINTS),
    dashboardMode: getBooleanSettingFromCookieStorage(CookieStorageKeys.DASHBOARD_MODE),
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
    nHourForecast: 4,
    nationalAggregationLevel: NationalAggregation.GSP,
    pLevels: getValidatedPLevels(),
    showCloudLayer: false,
    activeChannel: "COMPOSITE_VISIBLE",
    showPvLayer: true,
    trialExpiredAt: ""
  });

export default useGlobalState;
