import { createGlobalState } from "react-hooks-global-state";

export function get30MinNow() {
  // this is a function to get the date of now, but rounded up to the closest 30 minutes
  const date = new Date();
  const minutes = date.getMinutes();
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
  selectedDeltaGsp?: number;
  show4hView?: boolean;
};

const { useGlobalState } = createGlobalState<GlobalStateType>({
  selectedISOTime: get30MinNow(),
  timeNow: get30MinNow(),
  clickedGspId: undefined,
  forecastCreationTime: undefined,
  visibleLines: ["GENERATION", "GENERATION_UPDATED", "FORECAST", "PAST_FORECAST", "4HR_FORECAST"],
  selectedBuckets: ["-4", "-3", "-2", "-1", "1", "2", "3", "4"],
  selectedDeltaGsp: undefined,
  show4hView:
    process.env.NODE_ENV === "development" ||
    (!!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production")
});

export default useGlobalState;
