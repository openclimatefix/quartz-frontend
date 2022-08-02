import React from "react";
import Footer from "./footer";
import Navbar from "./navbar";

type SideLayoutProps = {
  className?: string;
};

const SideLayout: React.FC<SideLayoutProps> = ({ children, className }) => {
  return (
    <div
      className={
        "focus:outline-none border-t border-black h-full text-white justify-between flex flex-col bg-mapbox-black-500 z-20 " +
        (className || "")
      }
    >
      <Navbar />

      <div className="relative h-full  overflow-y-scroll">{children}</div>
    </div>
  );
};

export default SideLayout;
