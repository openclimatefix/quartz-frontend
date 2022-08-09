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
        <div className="relative h-full  overflow-y-scroll">{children}</div>
        <SideFooter />
      </div>
      <div className="absolute bottom-12 -right-5">
        <ExpandButton isOpen={isOpen} onClick={() => setIsOpen((o) => !o)} />
      </div>
    </div>
  );
};

export default SideLayout;
