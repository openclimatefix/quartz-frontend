"use client";

import { OCFLogo } from "@/src/assets/logo";
import { useUserMenu } from "@/src/hooks/useUserMenu";
import useGlobalState from "../helpers/globalState";
import { DownloadIcon } from "@/src/components/icons/icons";
import { DateTime } from "luxon";
import { KWtoMW } from "@/src/helpers/dataFormats";
import { useUser } from "@auth0/nextjs-auth0/client";

type HeaderProps = {};

const Header: React.FC<HeaderProps> = () => {
  const { showUserMenu, setShowUserMenu } = useUserMenu();
  const [combinedData] = useGlobalState("combinedData");
  const { user } = useUser();
  const downloadCsv = async () => {
    console.log("Download CSV");
    if (!combinedData) return;
    // Remap combined data into array of objects with same timestamp and values for each key
    type CombinedDatumWithTimestamp = {
      solarForecastData?: number | null;
      solarGenerationData?: number | null;
      windForecastData?: number | null;
      windGenerationData?: number | null;
      time: string;
    };
    const csvProperties = {
      solarForecastData: null,
      solarGenerationData: null,
      windForecastData: null,
      windGenerationData: null,
    };
    const csvHeaderLabels = {
      solarForecastData: "Solar Forecast",
      solarGenerationData: "Solar Generation",
      windForecastData: "Wind Forecast",
      windGenerationData: "Wind Generation",
      time: "Time",
    };
    const combinedDataByTimestampMap: Map<string, CombinedDatumWithTimestamp> =
      new Map();
    for (const [type, values] of Object.entries(combinedData)) {
      if (!type) continue;
      if (!Object.keys(csvProperties).includes(type)) continue;

      const data = combinedData[type as keyof typeof combinedData];

      if (data?.values.length) {
        for (const value of data.values.sort()) {
          if (!value.Time) continue;
          const existingEntry = combinedDataByTimestampMap.get(value.Time);
          if (existingEntry) {
            existingEntry[type as keyof typeof combinedData] = value.PowerKW
              ? KWtoMW(value.PowerKW, 2)
              : null;
            combinedDataByTimestampMap.set(value.Time, existingEntry);
          } else {
            combinedDataByTimestampMap.set(value.Time, {
              time: value.Time,
              ...csvProperties,
              [type]: value.PowerKW ? KWtoMW(value.PowerKW, 2) : null,
            });
          }
        }
      }
    }
    const sortedMap = new Map([...combinedDataByTimestampMap].sort());
    let csvHeader =
      Object.keys(sortedMap.values().next().value)
        .map((key) => csvHeaderLabels[key as keyof typeof csvHeaderLabels])
        .join(",") + "\n"; // header row
    let csvBody = "";
    for (const row of sortedMap.values()) {
      csvBody += Object.values(row).join(",") + "\n";
    }
    let csv = csvHeader + csvBody;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const now = DateTime.now().setZone("ist");
    a.download = `Quartz-Data_${now
      .toString()
      .slice(0, 16)
      .replaceAll("T", "_")}.csv`;
    document.body.appendChild(a);
    // console.log("csv", csv);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      <div
        id={"ProfileDropdownBackdrop"}
        onClick={() => setShowUserMenu(false)}
        className={`absolute inset-0 bg-black/50 z-30 ${
          showUserMenu ? "block" : "hidden"
        }`}
      ></div>
      <header className="h-16 text-white px-4 bg-black flex absolute top-0 w-full p-1 text-sm items-center z-30">
        <div className="flex-grow-0 -mt-0.5 flex-shrink-0">
          <a className="flex h-8 self-center w-auto" href="/" rel="noreferrer">
            <img
              src="/QUARTZSOLAR_LOGO_ICON.svg"
              alt="quartz_logo"
              className="h-8 w-auto"
            />
          </a>
        </div>
        <div className="p-1 mt-0.5 mb-1.5 items-end flex flex-col">
          <a className="flex h-6 w-auto" href="/" rel="noreferrer">
            <img
              src="/QUARTZENERGY_LOGO_TEXTONLY_WHITE.svg"
              alt="quartz_logo"
              className="h-8 w-auto"
            />
          </a>
          <div className="mr-[6px] flex items-center">
            <span className="block mr-[1px] font-light tracking-wide text-[10px]">
              powered by
            </span>
            <OCFLogo />
          </div>
        </div>
        <div className="grow text-center inline-flex px-8 gap-5 items-center"></div>
        <div className="flex items-center relative gap-5 py-1">
          {user && (
            <>
              <button
                id="DownloadCsvButton"
                className="text-sm p-2"
                title={"Download CSV"}
                tabIndex={0}
                onClick={downloadCsv}
              >
                <DownloadIcon />
              </button>
              <button
                onClick={() => {
                  setShowUserMenu(() => !showUserMenu);
                }}
                tabIndex={0}
                className="w-8 h-8 flex items-center justify-center text-md rounded-full cursor-pointer bg-gradient-to-br from-quartz-yellow to-quartz-blue"
              >
                <span className={"text-black"}>
                  {user
                    ? user.name?.split(" ").map((name) => name.slice(0, 1))
                    : ""}
                </span>
              </button>
              <div
                id="ProfileDropdown"
                className={`flex absolute right-0 ${
                  showUserMenu ? "top-10" : "absolute -top-40"
                }`}
              >
                <div className="absolute right-0 flex flex-col mt-2 w-48 py-1 bg-white text-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                  <span className="block px-4 py-2 text-xs ">
                    Signed in as {user?.email}
                  </span>
                  <a
                    href="/api/auth/logout"
                    className="block px-4 py-2 text-sm"
                    tabIndex={2}
                  >
                    Sign out
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;
