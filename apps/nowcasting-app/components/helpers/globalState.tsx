import { createGlobalState } from "react-hooks-global-state";
import { getDeltaBucketKeys } from "../../constant";
import mapboxgl from "mapbox-gl";

export function get30MinNow(offsetMinutes = 0) {
  // this is a function to get the date of now, but rounded up to the closest 30 minutes
  const date = new Date();

  let minutes = date.getMinutes();
  if (offsetMinutes !== 0) {
    minutes += offsetMinutes;
    date.setMinutes(minutes);
  }
  if (minutes <= 30) {
    date.setHours(date.getHours());
    date.setMinutes(30, 0, 0); // Resets also seconds and milliseconds
  } else {
    date.setHours(date.getHours() + 1);
    date.setMinutes(0, 0, 0); // Resets also seconds and milliseconds
  }
  return date.toISOString();
}

type GlobalStateType = {
  selectedISOTime?: string;
  timeNow: string;
  clickedGspId?: number;
  forecastCreationTime?: string;
  visibleLines: string[];
  selectedBuckets: string[];
  maps: mapboxgl.Map[];
  lng: number;
  lat: number;
  zoom: number;
  show4hView?: boolean;
};

const { useGlobalState } = createGlobalState<GlobalStateType>({
  selectedISOTime: get30MinNow(),
  timeNow: get30MinNow(),
  clickedGspId: undefined,
  forecastCreationTime: undefined,
  visibleLines: ["GENERATION", "GENERATION_UPDATED", "FORECAST", "PAST_FORECAST"],
  selectedBuckets: getDeltaBucketKeys().filter((key) => key !== "ZERO"),
  maps: [],
  lng: -2.3175601,
  lat: 54.70534432,
  zoom: 5,
  show4hView:
    process.env.NODE_ENV === "development" ||
    // Also hide on Staging/Preview deployments for now, only show on dev by default.
    // (!!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") ||
    false
});

export default useGlobalState;
