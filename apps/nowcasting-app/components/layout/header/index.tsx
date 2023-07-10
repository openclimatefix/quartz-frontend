import { classNames, isProduction } from "../../helpers/utils";
import ProfileDropDown from "./profile-dropdown";
import { OCFlogo } from "../../icons/logo";
import Link from "next/link";
import { Menu } from "@headlessui/react";
import { VIEWS } from "../../../constant";
import { Dispatch, SetStateAction } from "react";
import { ExternalLinkIcon } from "../../icons/icons";
import useGlobalState from "../../helpers/globalState";

type HeaderLinkProps = {
  url: string;
  text: string;
  className?: string;
  disabled?: boolean;
  currentView?: VIEWS;
  view?: VIEWS;
  setViewFunc?: Dispatch<SetStateAction<VIEWS>>;
};
const HeaderLink: React.FC<HeaderLinkProps> = ({
  url,
  text,
  className,
  disabled = false,
  currentView,
  view,
  setViewFunc
}) => {
  const computedClasses = classNames(
    className || "",
    disabled ? "text-gray-500 cursor-not-allowed" : "cursor-pointer hover:text-ocf-yellow-400",
    "flex px-4 py-2 font-semibold text-sm"
  );

  // Denotes external link for styling
  if (url.includes("http")) {
    return (
      <Menu.Item>
        <a href={url} className={computedClasses} target="_blank" rel="noreferrer">
          {text}
          <ExternalLinkIcon className="inline-block w-3 h-3 ml-[6px] self-center text-inherit" />
        </a>
      </Menu.Item>
    );
  }

  if (setViewFunc && view) {
    const isCurrentView = currentView === view;
    let textColorClasses = isCurrentView ? "text-ocf-yellow" : "text-white";
    if (disabled) textColorClasses = "text-gray-500 cursor-not-allowed";
    return (
      <Menu.Item>
        <a
          className={classNames(computedClasses, textColorClasses)}
          onClick={() => {
            if (!disabled) setViewFunc(view);
          }}
        >
          {text}
        </a>
      </Menu.Item>
    );
  }

  return (
    <Menu.Item>
      {({ active }) => (
        <Link
          href={url}
          className={classNames(computedClasses, active ? "text-ocf-yellow" : "text-white")}
        >
          {text}
        </Link>
      )}
    </Menu.Item>
  );
};

type HeaderProps = { view: VIEWS; setView: Dispatch<SetStateAction<VIEWS>> };

const Header: React.FC<HeaderProps> = ({ view, setView }) => {
  return (
    <header className="text-white text-right px-4 bg-black flex absolute top-0 w-full p-1 text-sm items-center z-30">
      <div className="flex-grow-0 -mt-0.5 flex-shrink-0">
        <a
          className="flex h-8 self-center w-auto"
          target="_blank"
          href="https://quartz.solar/"
          rel="noreferrer"
        >
          <img src="/QUARTZSOLAR_LOGO_ICON.svg" alt="quartz_logo" className="h-8 w-auto" />
        </a>
      </div>
      <div className="p-1 mt-0.5 mb-1.5 items-end flex flex-col">
        <a
          className="flex h-6 w-auto"
          target="_blank"
          href="https://quartz.solar/"
          rel="noreferrer"
        >
          <img
            src="/QUARTZSOLAR_LOGO_TEXTONLY_WHITE.svg"
            alt="quartz_logo"
            className="h-8 w-auto"
          />
        </a>
        <div className="mr-[6px] flex items-center">
          <span className="block mr-[1px] font-light tracking-wide text-[10px]">powered by</span>
          <OCFlogo />
        </div>
      </div>
      <div className="grow text-center inline-flex px-8 gap-5 items-center">
        <Menu>
          <HeaderLink
            url="/"
            view={VIEWS.FORECAST}
            currentView={view}
            setViewFunc={setView}
            text="PV Forecast"
          />
          <HeaderLink
            url="/"
            view={VIEWS.SOLAR_SITES}
            currentView={view}
            setViewFunc={setView}
            text="Solar Sites"
            disabled={isProduction}
          />
          <HeaderLink
            url="/"
            view={VIEWS.DELTA}
            currentView={view}
            setViewFunc={setView}
            text="Delta"
          />
          <HeaderLink
            url="https://openclimatefix.notion.site/openclimatefix/Nowcasting-Documentation-0d718915650e4f098470d695aa3494bf"
            text="Documentation"
          />
        </Menu>
      </div>
      <div className="py-1">
        <ProfileDropDown />
      </div>
    </header>
  );
};

export default Header;
