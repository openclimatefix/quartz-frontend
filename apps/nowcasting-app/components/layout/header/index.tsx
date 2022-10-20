import { classNames } from "../../helpers/utils";
import ProfileDropDown from "./profile-dropdown";
import { OCFlogo } from "../../icons/logo";
import Link from "next/link";
import { Menu } from "@headlessui/react";
import { VIEWS } from "../../../constant";
import { Dispatch, SetStateAction } from "react";

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
    disabled
      ? "text-gray-500 cursor-not-allowed"
      : "text-white cursor-pointer hover:text-ocf-yellow-400",
    "block px-4 py-2 font-semibold text-sm"
  );

  if (url.includes("http")) {
    return (
      <Menu.Item>
        <a href={url} className={computedClasses} target="_blank" rel="noreferrer">
          {text}
        </a>
      </Menu.Item>
    );
  }

  if (setViewFunc && view) {
    const isCurrentView = currentView === view;
    return (
      <Menu.Item>
        <a
          className={classNames(computedClasses, isCurrentView ? "text-ocf-yellow" : "")}
          onClick={() => setViewFunc(view)}
        >
          {text}
        </a>
      </Menu.Item>
    );
  }

  return (
    <Menu.Item>
      {({ active }) => (
        <Link href={url} className={classNames(computedClasses, active ? "text-ocf-yellow" : "")}>
          {text}
        </Link>
      )}
    </Menu.Item>
  );
};

type HeaderProps = { view: VIEWS; setView: Dispatch<SetStateAction<VIEWS>> };

const Header: React.FC<HeaderProps> = ({ view, setView }) => {
  return (
    <header className="text-white text-right pl-3 pr-4 bg-black flex absolute top-0 w-full h-16 p-1 text-sm items-center">
      <div className="p-1 mt-1 items-end flex flex-col">
        <a
          className="flex h-6 w-auto mr-2"
          target="_blank"
          href="https://nowcasting.io/"
          rel="noreferrer"
        >
          <img src="/NOWCASTING_Secondary-white.svg" alt="ofc" className="h-6 w-auto" />
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
            disabled
          />
          <HeaderLink
            url="/"
            view={VIEWS.DELTA}
            currentView={view}
            setViewFunc={setView}
            text="Delta"
            disabled
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
