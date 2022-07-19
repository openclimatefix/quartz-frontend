import { createGlobalState } from "react-hooks-global-state";
import { get30MinNow } from "./utils";

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
