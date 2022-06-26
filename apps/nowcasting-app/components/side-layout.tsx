import React from "react";
import useGetTimeKeyControls from "./hooks/use-get-time-key-controls";
import Navbar from "./navbar";

type SideLayoutProps = {
  className?: string;
};

const SideLayout: React.FC<SideLayoutProps> = ({ children, className }) => {
  const keyControls = useGetTimeKeyControls();
  return (
    <div
      onKeyDown={keyControls}
      tabIndex={0}
      className={
        " focus:outline-none border-t border-black h-full text-white justify-between flex flex-col bg-mapbox-black-500 	z-20 " +
        (className || "")
      }
    >
      <Navbar />

      <div className="relative h-full">
        {children}
        <div className="absolute bottom-0 bg-mapbox-black p-2 z-10" style={{ right: "-120px" }}>
          <img src="/OCF_icon_wht.svg" alt="ofc" width={100} />
        </div>
      </div>
    </div>
  );
};

export default SideLayout;
