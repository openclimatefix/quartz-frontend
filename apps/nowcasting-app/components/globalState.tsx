/*
Global state of the App. It contains
1. timeNow: The time now (rounded to 30 mins)
2. selectedISOTime: The selected time
3. clickedGspId: The GSP which has been selected
4. forecastCreationTime: The creation time of the current forecast
*/

import { createGlobalState } from "react-hooks-global-state";

export function get30MinNow() {
  // this is a function to get the date of now, but rounded up to the closest 30 minutes
  const date = new Date();
  const minites = date.getMinutes();
  if (minites <= 30) {
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
};

const { useGlobalState } = createGlobalState<GlobalStateType>({
  selectedISOTime: get30MinNow(),
  timeNow: get30MinNow(),
  clickedGspId: undefined,
  forecastCreationTime: undefined,
});

export default useGlobalState;
