import { FC } from "react";
import { DELTA_BUCKET, getDeltaBucketKeys } from "../../constant";

const DeltaColorGuideBar: FC<{}> = () => {
  const deltaKeys = getDeltaBucketKeys();
  return (
    <>
      <div className="absolute bg-mapbox-black-700 bottom-12 flex left-0 ml-12 z-20">
        <div className="flex justify-between h-full font-bold relative items-end text-sm">
          {deltaKeys.map((value) => {
            let background = "";
            let opacity = 0;
            let textColor = "";
            let text = 0;
            switch (value) {
              case deltaKeys[0]:
                background = "bg-ocf-delta-100";
                (opacity = 3), (textColor = "text-black"), (text = DELTA_BUCKET.NEG4);
                break;
              case deltaKeys[1]:
                (background = "bg-ocf-delta-200"), (opacity = 20), (textColor = "text-black");
                text = DELTA_BUCKET.NEG3;
                break;
              case deltaKeys[2]:
                (background = "bg-ocf-delta-300"), (opacity = 40), (textColor = "text-black");
                text = DELTA_BUCKET.NEG2;
                break;
              case deltaKeys[3]:
                (background = "bg-ocf-delta-400"),
                  (opacity = 60),
                  (textColor = "text-ocf-gray-300");
                text = DELTA_BUCKET.NEG1;
                break;
              case deltaKeys[4]:
                (background = "bg-ocf-delta-500"),
                  (opacity = 80),
                  (textColor = "text-ocf-gray-300");
                text = DELTA_BUCKET.ZERO;
                break;
              case deltaKeys[5]:
                (background = "bg-ocf-delta-600"),
                  (opacity = 100),
                  (textColor = "text-ocf-gray-300");
                text = DELTA_BUCKET.POS1;
                break;
              case deltaKeys[6]:
                (background = "bg-ocf-delta-700"), (opacity = 100), (textColor = "text-black");
                text = DELTA_BUCKET.POS2;
                break;
              case deltaKeys[7]:
                (background = "bg-ocf-delta-800"), (opacity = 100), (textColor = "text-black");
                text = DELTA_BUCKET.POS3;
                break;
              case deltaKeys[8]:
                (background = "bg-ocf-delta-900"), (opacity = 100), (textColor = "text-black");
                text = DELTA_BUCKET.POS4;
                break;
            }
            return (
              <div
                key={value}
                className={`px-3 py-[1px] ${background} text-xs md:text-sm whitespace-nowrap ${
                  text !== 0 ? "border-l border-ocf-black-100" : ""
                } ${textColor}`}
              >
                {text > 0 ? "+" : ""}
                {text}
                <span className="text-xs font-normal">{text === DELTA_BUCKET.NEG4 && " MW"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default DeltaColorGuideBar;
