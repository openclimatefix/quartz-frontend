import { createGlobalState } from "react-hooks-global-state";

export function get30MinNow() {
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
  clickedGspId?: number;
};

const { useGlobalState } = createGlobalState<GlobalStateType>({
  selectedISOTime: get30MinNow(),
  clickedGspId: undefined,
});

export default useGlobalState;
