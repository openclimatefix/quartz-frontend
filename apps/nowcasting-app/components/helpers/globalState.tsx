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
};

const { useGlobalState } = createGlobalState<GlobalStateType>({
  selectedISOTime: get30MinNow(),
  timeNow: get30MinNow(),
  clickedGspId: undefined,
  forecastCreationTime: undefined
});

export default useGlobalState;
