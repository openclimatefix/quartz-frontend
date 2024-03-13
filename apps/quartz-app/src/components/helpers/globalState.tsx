// Purpose: Global state management using react-hooks-global-state.

import { CombinedData } from "@/src/types/data";
import { createGlobalState } from "react-hooks-global-state";

export type GlobalStateType = {
  visibleLines: string[];
  combinedData: CombinedData;
};

export const {
  useGlobalState,
  getGlobalState,
  setGlobalState,
}: Pick<
  {
    useGlobalStateProvider: () => void;
    useGlobalState: <StateKey extends keyof GlobalStateType>(
      stateKey: StateKey
    ) => readonly [
      GlobalStateType[StateKey],
      (u: import("react").SetStateAction<GlobalStateType[StateKey]>) => void
    ];
    getGlobalState: <StateKey_1 extends keyof GlobalStateType>(
      stateKey: StateKey_1
    ) => GlobalStateType[StateKey_1];
    setGlobalState: <StateKey_2 extends keyof GlobalStateType>(
      stateKey: StateKey_2,
      update: import("react").SetStateAction<GlobalStateType[StateKey_2]>
    ) => void;
    getState: () => GlobalStateType;
    setState: (nextGlobalState: GlobalStateType) => void;
    dispatch: (action: never) => never;
  },
  | "useGlobalStateProvider"
  | "useGlobalState"
  | "getGlobalState"
  | "setGlobalState"
> = createGlobalState<GlobalStateType>({
  visibleLines: ["Solar", "Wind"],
  combinedData: {} as CombinedData,
});

export default useGlobalState;
