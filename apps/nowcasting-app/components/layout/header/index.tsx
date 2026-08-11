import { classNames } from "../../helpers/utils";
import ProfileDropDown from "./profile-dropdown";
import CountryToggle from "./country-toggle";
import { OCFlogo } from "../../icons/logo";
import Link from "next/link";
import { useRouter } from "next/router";
import { Menu } from "@headlessui/react";
import { ReactNode } from "react";
import { ExternalLinkIcon } from "../../icons/icons";

/**
 * The top nav — "what you are looking at", and only that (contract §6).
 *
 * It used to carry a three-way view switcher: Forecast, Solar Sites and Delta, hardcoded and
 * shown for every country whether or not the country had the data. Phase 6 dissolves all three
 * (§2). Delta was never a peer view, it was a *comparison*, and it now lives on the map
 * cluster where the colour it changes is explained. Solar Sites was never a country view — it
 * is tenancy-scoped, on a different backend, with different geometry — and it now has its own
 * route, so what is left of it here is a link rather than a mode.
 *
 * That leaves navigation proper: where you are, which countries are drawn, and the account.
 * Which country the *chart* reads is picked in the chart header instead — see Track A's notes
 * and `components/charts/country-picker.tsx`.
 */

type HeaderLinkProps = {
  url: string;
  text: string;
  className?: string;
  disabled?: boolean;
};

const HeaderLink: React.FC<HeaderLinkProps> = ({ url, text, className, disabled = false }) => {
  const { pathname } = useRouter();
  const computedClasses = classNames(
    className || "",
    disabled ? "text-gray-500 cursor-not-allowed" : "cursor-pointer hover:text-ocf-yellow-400",
    "flex px-1 sm:px-4 py-2 font-semibold text-xs sm:text-sm"
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

  // The route itself says which one is current, rather than a `view` passed down from a page.
  const isCurrent = pathname === url;

  return (
    <Menu.Item>
      {({ active }) => (
        <Link
          href={url}
          aria-current={isCurrent ? "page" : undefined}
          className={classNames(
            computedClasses,
            isCurrent || active ? "text-ocf-yellow" : "text-white"
          )}
        >
          {text}
        </Link>
      )}
    </Menu.Item>
  );
};

type HeaderProps = {
  isLoggedIn?: boolean;
  children?: ReactNode;
};

const Header: React.FC<HeaderProps> = ({ isLoggedIn = true, children }) => {
  return (
    <header className="h-16 text-white text-right sm:px-4 bg-black flex absolute top-0 w-full overflow-y-visible p-1 text-sm items-center z-30">
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
      <div className="grow text-center inline-flex px-2 sm:px-8 gap-2 sm:gap-5 items-center">
        {isLoggedIn && (
          <Menu>
            <HeaderLink url="/" text="Forecast" />
            <HeaderLink url="/sites" text="Solar Sites" />
          </Menu>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isLoggedIn && <CountryToggle />}
        <div className="py-1">
          {isLoggedIn && <ProfileDropDown />}
          {children}
        </div>
      </div>
    </header>
  );
};

export default Header;
