import React from "react";

const SitesLegend: React.FC<{ color: string }> = ({ color }) => {
  color = "bg-solar";
  return (
    <>
      <div className="absolute bottom-0 left-32">
        <div className="flex justify-around items-center text-solar">
          <div
            style={{ width: `128px`, height: `64px` }}
            className="border-2  border-solar border-b-0 rounded-t-full"
          >
            <div style={{ fontSize: `8px` }} className="absolute right-3 -bottom-0.5 text-center">
              500
            </div>

            <div
              style={{ width: `88px`, height: `44px` }}
              className="absolute  bottom-0 border-2  border-solar border-b-0 rounded-t-full"
            >
              <div style={{ fontSize: `8px` }} className="absolute right-2  -bottom-0.5 ">
                200
              </div>

              <div
                style={{ width: `54px`, height: `27px` }}
                className="absolute border-2 bottom-0 border-b-0 border-solar rounded-t-full"
              >
                <div style={{ fontSize: `8px` }} className="absolute right-1.5 -bottom-0.5">
                  100
                </div>

                <div
                  style={{ width: `26px`, height: `14px` }}
                  className="border-2 absolute bottom-0 border-b-0 border-solar  text-center rounded-t-full pr-2"
                >
                  <div style={{ fontSize: `8px` }} className="absolute -bottom-0.5 right-1.5 ">
                    50
                  </div>
                </div>
                <div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SitesLegend;
