import React, { useState } from "react";
import ExpandButton from "./expand-button";
import SideFooter from "./side-footer";

type SideLayoutProps = {
  className?: string;
};

const SideLayout: React.FC<SideLayoutProps> = ({ children, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`h-full absolute  z-20 `} style={{ width: isOpen ? "90%" : "44%" }}>
      <div
        className={
          "focus:outline-none border-t border-black h-full text-white justify-between flex flex-col bg-mapbox-black-500 z-20 " +
          (className || "")
        }
      >
        <SideFooter />
        <div className="relative h-full flex flex-col overflow-y-scroll">{children}</div>
      </div>
      <div className="absolute bottom-16 -right-5 h-10 mb-[3px]">
        <ExpandButton isOpen={isOpen} onClick={() => setIsOpen((o) => !o)} />
      </div>
    </div>
  );
};

export default SideLayout;
