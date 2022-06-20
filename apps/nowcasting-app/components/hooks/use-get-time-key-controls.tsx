import { KeyboardEventHandler, useEffect, useMemo } from "react";
import useGlobalState from "../globalState";
import { addMinutesToISODate } from "../utils";

const leftKey = "ArrowLeft";
const rightKey = "ArrowRight";
const useGetTimeKeyControls = () => {
  const [, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const handleKeyDown: KeyboardEventHandler<HTMLElement> = useMemo(
    () => (e) => {
      if (e.key === leftKey) {
        setSelectedISOTime((selectedISOTime) => addMinutesToISODate(selectedISOTime || "", -30));
      } else if (e.key === rightKey) {
        setSelectedISOTime((selectedISOTime) => addMinutesToISODate(selectedISOTime || "", 30));
      }
    },
    [],
  );
  return handleKeyDown;
};
export default useGetTimeKeyControls;
