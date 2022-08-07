import useGlobalState from "../globalState";
import Tooltip from "../tooltip";
import { formatISODateStringHuman } from "../utils";

const chartInfo = (forecastCreationTime?: string) => (
  <div className="w-full w-64 p-2 text-sm">
    <ul className="list-none space-y-2">
      <li>All datetimes are in Europe/London timezone.</li>
      <li>
        Following{" "}
        <a
          className=" underline"
          href="https://www.solar.sheffield.ac.uk/pvlive/"
          target="_blank"
          rel="noreferrer"
        >
          PVLive
        </a>
        , datetimes show the end of the settlement period. For example 17:00 refers to solar
        generation between 16:30 to 17:00.
      </li>
      <li>The Y axis units are in MW, for the national and GSP plots. </li>
      <li> OCF Forecast Creation Time: {formatISODateStringHuman(forecastCreationTime || "")}</li>
    </ul>
  </div>
);
type SideFooterProps = {};

const SideFooter: React.FC<SideFooterProps> = ({}) => {
  const [forecastCreationTime] = useGlobalState("forecastCreationTime");

  return (
    <footer className="text-white text-right px-2 bg-black flex absolute bottom-0 w-full p-1 text-sm ">
      <div className="p-1">
        <a
          className="flex h-6 w-auto mr-2"
          target="_blank"
          href="https://nowcasting.io/"
          rel="noreferrer"
        >
          <img src="/NOWCASTING_Secondary-white.svg" alt="ofc" className="" />
        </a>
      </div>
      <div className="grow text-center inline-flex px-2 gap-2 items-center">
        <a href="#" target="_blank" rel="noreferrer">
          Docs
        </a>
        |
        <Tooltip tip={chartInfo(forecastCreationTime)} position="right" className={"text-left"}>
          Data
        </Tooltip>
        |{" "}
        <Tooltip
          tip={"For help, please email OCF at ops@openclimatefix.org"}
          position="right"
          className={"text-left"}
        >
          Help
        </Tooltip>
        |
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSf08XJPFwsNHxYiHUTV4g9CHWQzxAn0gSiAXXFkaI_3wjpNWw/viewform"
          target="_blank"
          rel="noreferrer"
        >
          Feedback
        </a>
      </div>
      <div className="py-1">
        <a
          className="flex h-6 w-auto"
          target="_blank"
          href="https://www.openclimatefix.org/"
          rel="noreferrer"
        >
          <img src="/OCF_icon_wht.svg" alt="ofc" />
        </a>
      </div>
    </footer>
  );
};

export default SideFooter;
