import React from "react";
import Footer from "./footer";

type SideLayoutProps = {
  className?: string;
};

const SideLayout: React.FC<SideLayoutProps> = ({ children, className }) => {
  return (
    <div
      className={
        "border-t border-black h-full text-white justify-between flex flex-col bg-mapbox-black-500 " +
        (className || "")
      }
    >
      <div className="h-10 mb-auta">{children}</div>
      <Footer />
    </div>
  );
};

export default SideLayout;
