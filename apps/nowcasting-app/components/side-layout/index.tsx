import { useState } from "react";
import ExpandButton from "./expand-button";
import useGlobalState from "../helpers/globalState";

type SideLayoutProps = {
  children: React.ReactNode;
  className?: string;
  dashboardModeActive?: boolean;
  bottomPadding?: boolean;
};

const SideLayout: React.FC<SideLayoutProps> = ({
  children,
  className,
  dashboardModeActive = false,
  bottomPadding = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const closedWidth = dashboardModeActive ? "50%" : "44%";
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
        <div
          className={`min-h-full flex flex-col overflow-y-scroll${bottomPadding ? " pb-32" : ""}`}
        >
          {children}
        </div>
      </div>
      <div className="absolute bottom-16 -right-5 h-10 mb-[3px]">
        <ExpandButton isOpen={isOpen} onClick={() => setIsOpen((o) => !o)} />
      </div>
    </div>
  );
};

export default SideLayout;
