import useGlobalState from "../../helpers/globalState";
import Tooltip from "../../tooltip";
import { classNames, formatISODateStringHumanNumbersOnly } from "../../helpers/utils";
import ProfileDropDown from "./profile-dropdown";
import { OCFlogo } from "../../icons/logo";
import Link from "next/link";

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
      <li>
        {" "}
        OCF Forecast Creation Time:{" "}
        {formatISODateStringHumanNumbersOnly(forecastCreationTime || "")}
      </li>
    </ul>
  </div>
);
type HeaderProps = {};

const Header: React.FC<HeaderProps> = ({}) => {
  const [forecastCreationTime] = useGlobalState("forecastCreationTime");

  return (
    <header className="text-white text-right px-2 bg-black flex absolute top-0 w-full h-16 p-1 text-sm items-center">
      <div className="p-1 items-center inline-flex">
        <a
          className="flex h-6 w-auto mr-2"
          target="_blank"
          href="https://nowcasting.io/"
          rel="noreferrer"
        >
          <img src="/NOWCASTING_Secondary-white.svg" alt="ofc" className="h-6 w-auto" />
        </a>
      </div>
      <div className="grow text-center inline-flex px-2 gap-5 items-center">
        <a
          href="https://openclimatefix.notion.site/openclimatefix/Nowcasting-Documentation-0d718915650e4f098470d695aa3494bf"
          target="_blank"
          rel="noreferrer"
        >
          Docs
        </a>
        <Tooltip tip={chartInfo(forecastCreationTime)} position="right" className={"text-left"}>
          Data
        </Tooltip>
        <Tooltip
          tip={
            <div
              onClick={() => {
                var copyText = "ops@openclimatefix.org";
                navigator.clipboard.writeText(copyText);
              }}
              className="cursor-pointer"
              title="Copy Email to Clipboard"
            >
              For help, please email OCF at <span>ops@openclimatefix.org</span>
            </div>
          }
          position="right"
          className={"text-left"}
        >
          Help
        </Tooltip>
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSf08XJPFwsNHxYiHUTV4g9CHWQzxAn0gSiAXXFkaI_3wjpNWw/viewform"
          target="_blank"
          rel="noreferrer"
        >
          Feedback
        </a>
      </div>
      <OCFlogo />
      <div className="py-1">
        <ProfileDropDown />
      </div>
    </header>
  );
};

export default Header;
