import { FC, ReactNode, useEffect, useState } from "react";
import ExpandButton from "./expand-button";
import useGlobalState from "../helpers/globalState";
import { ChartInfo } from "../../ChartInfo";
import { InfoIcon } from "../icons/icons";
import Tooltip, { TooltipPosition } from "../tooltip";
import { VIEWS } from "../../constant";

type SideLayoutProps = {
  children: ReactNode;
  className?: string;
  dashboardModeActive?: boolean;
  bottomPadding?: boolean;
};

const SideLayout: FC<SideLayoutProps> = ({
  children,
  className,
  dashboardModeActive = false,
  bottomPadding = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view] = useGlobalState("view");
  // const closedWidth = dashboardModeActive ? "50%" : "44%";
  const closedWidth = "50%";
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsOpen(true);
      setIsMobile(true);
    }
  }, []);
  let position: TooltipPosition = "top";
  if (isMobile) {
    position = isOpen ? "top-left" : "top-middle";
  }
  return (
    <div
      className={`h-full pt-16 absolute top-0 left-0 z-20 ${className || ""}`}
      style={{ width: isOpen ? "90%" : closedWidth }}
    >
      <div
        className={
          "focus:outline-none h-full text-white justify-between flex flex-col bg-mapbox-black-500 z-20 "
        }
      >
        <div className={`min-h-full max-h-full flex flex-col overflow-y-scroll`}>{children}</div>
      </div>
      <div className="absolute bottom-12 -right-4 h-10 z-20">
        <ExpandButton isOpen={isOpen} onClick={() => setIsOpen((o) => !o)} />
      </div>

      {view !== VIEWS.SOLAR_SITES && (
        <div className="absolute bottom-3 -right-4 bg-mapbox-black-500 p-1.5 rounded-full">
          <Tooltip
            tip={
              <div className="w-64 rounded-md">
                <ChartInfo />
              </div>
            }
            position={position}
            className={"text-right"}
            fullWidth
          >
            <InfoIcon />
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export default SideLayout;
