import { createGlobalState } from "react-hooks-global-state";
import { getDeltaBucketKeys, VIEWS } from "../../constant";
import mapboxgl from "mapbox-gl";

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
  if (isoTime.getMinutes() <= 30) {
    isoTime.setHours(isoTime.getHours());
    isoTime.setMinutes(30, 0, 0); // Resets also seconds and milliseconds
  } else {
    isoTime.setHours(isoTime.getHours() + 1);
    isoTime.setMinutes(0, 0, 0); // Resets also seconds and milliseconds
  }
  return isoTime;
}

export type GlobalStateType = {
  selectedISOTime?: string;
  timeNow: string;
  intervals: any[];
  clickedGspId?: number;
  forecastCreationTime?: string;
  view: VIEWS;
  visibleLines: string[];
  selectedBuckets: string[];
  maps: mapboxgl.Map[];
  lng: number;
  lat: number;
  zoom: number;
  showSiteCount?: boolean;
  show4hView?: boolean;
};

export const { useGlobalState, getGlobalState, setGlobalState } =
  createGlobalState<GlobalStateType>({
    selectedISOTime: get30MinNow(),
    timeNow: get30MinNow(),
    intervals: [],
    clickedGspId: undefined,
    forecastCreationTime: undefined,
    view: VIEWS.FORECAST,
    visibleLines: ["GENERATION", "GENERATION_UPDATED", "FORECAST", "PAST_FORECAST"],
    selectedBuckets: getDeltaBucketKeys().filter((key) => key !== "ZERO"),
    maps: [],
    lng: -2.3175601,
    lat: 54.70534432,
    zoom: 5,
    showSiteCount: undefined,
    show4hView:
      process.env.NODE_ENV === "development" ||
      // Also hide on Staging/Preview deployments for now, only show on dev by default.
      // (!!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") ||
      false
  });

export default useGlobalState;
