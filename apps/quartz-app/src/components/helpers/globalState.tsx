// Purpose: Global state management using react-hooks-global-state.

import { createGlobalState } from "react-hooks-global-state";

export type GlobalStateType = {
  visibleLines: string[];
};

export const { useGlobalState, getGlobalState, setGlobalState } =
  createGlobalState<GlobalStateType>({
    visibleLines: ["Solar", "Wind"],
  });

export default useGlobalState;
