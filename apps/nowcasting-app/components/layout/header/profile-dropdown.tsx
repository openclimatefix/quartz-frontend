import React, { Fragment, useEffect } from "react";
import { Menu, Transition } from "@headlessui/react";
import { useUser } from "@auth0/nextjs-auth0/client";
import pkg from "../../../package.json";
import { classNames, formatISODateStringHumanNumbersOnly, isProduction } from "../../helpers/utils";
import Link from "next/link";
import Tooltip from "../../tooltip";
import useGlobalState from "../../helpers/globalState";
import { Checkmark, ExternalLinkIcon } from "../../icons/icons";
import {
  CookieStorageKeys,
  getBooleanSettingFromCookieStorage,
  setBooleanSettingInLocalStorage
} from "../../helpers/cookieStorage";
const { version } = pkg;

interface IProfileDropDown {}

const ProfileDropDown = ({}: IProfileDropDown) => {
  const { user } = useUser();
  const [showNHourView, setShowNHourView] = useGlobalState("showNHourView");
  const [dashboardMode, setDashboardMode] = useGlobalState("dashboardMode");
  const [showConstraints, setShowConstraints] = useGlobalState("showConstraints");
  const toggleDashboardMode = () => {
    setDashboardMode(!dashboardMode);
    setBooleanSettingInLocalStorage(CookieStorageKeys.DASHBOARD_MODE, !dashboardMode);
  };
  const toggle4hView = () => {
    setShowNHourView(!showNHourView);
    setBooleanSettingInLocalStorage(CookieStorageKeys.N_HOUR_VIEW, !showNHourView);
  };
  const toggleConstraints = () => {
    setShowConstraints(!showConstraints);
    setBooleanSettingInLocalStorage(CookieStorageKeys.CONSTRAINTS, !showConstraints);
  };
  // Check cookies for the N-hour view setting and update the state if it's different
  // Doing this here on client-side because the user's cookies are not available on the server,
  // and React doesn't like it when the state is updated during hydration between server and client.
  useEffect(() => {
    // Also default to true if no cookie is set
    const showNHourViewLocal = getBooleanSettingFromCookieStorage(
      CookieStorageKeys.N_HOUR_VIEW,
      true
    );
    if (showNHourViewLocal !== showNHourView) {
      setShowNHourView(showNHourViewLocal);
    }
  }, []);

  return (
    <Menu as="div" className="relative z-20 ml-3">
      <div>
        <Menu.Button className="flex text-sm bg-white rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-danube-500">
          <span className="sr-only">Open user menu</span>
          <img className="w-8 h-8" src={(user && user.picture) || ""} alt="" />
        </Menu.Button>
      </div>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 top-12 w-52 py-1 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <Menu.Item>
            {({ active }) => (
              <div
                className={classNames(
                  active ? "bg-gray-100" : "",
                  "flex items-end justify-end px-4 py-2 text-sm text-gray-700 relative"
                )}
              >
                {showNHourView && (
                  <span className="flex items-center">
                    <Checkmark />
                  </span>
                )}
                <button
                  id={"UserMenu-NhViewBtn"}
                  onClick={toggle4hView}
                  className="ml-1 text-sm  font-medium text-ocf-black-600"
                >
                  {`N-hour forecast`}
                </button>
              </div>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <div
                className={classNames(
                  active ? "bg-gray-100" : "",
                  "flex items-end justify-end px-4 py-2 text-sm text-gray-700 relative"
                )}
              >
                {dashboardMode && (
                  <span className="flex items-center">
                    <Checkmark />
                  </span>
                )}
                <button
                  id={"UserMenu-DashboardModeBtn"}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleDashboardMode();
                  }}
                  className="ml-1 text-sm font-medium text-ocf-black-600"
                >
                  {`Dashboard mode`}
                </button>
              </div>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <div
                className={classNames(
                  active ? "bg-gray-100" : "",
                  "flex items-end justify-end px-4 py-2 text-sm text-gray-700 relative"
                )}
              >
                {showConstraints && (
                  <span className="flex items-center">
                    <Checkmark />
                  </span>
                )}
                <button
                  id={"UserMenu-ConstraintsBtn"}
                  onClick={toggleConstraints}
                  className="ml-1 text-sm  font-medium text-ocf-black-600"
                >
                  {`Constraint Boundaries`}
                </button>
              </div>
            )}
          </Menu.Item>

          <div className="w-full border-t border-gray-300" />

          <Menu.Item>
            <div className="px-4 pt-3 text-ocf-black-600 text-right">
              <a
                id={"UserMenu-DocumentationBtn"}
                href="https://openclimatefix.notion.site/Quartz-Solar-Documentation-0d718915650e4f098470d695aa3494bf"
              >
                Documentation{" "}
                <ExternalLinkIcon className="inline-block w-3 h-3 ml-[6px] mb-[1px] self-center text-inherit color-black" />
              </a>
            </div>
          </Menu.Item>
          <Menu.Item>
            <div className="px-4 pt-3 text-ocf-black-600 text-right">
              <Tooltip
                tip={
                  <div
                    onClick={() => {
                      var copyText = "support@quartz.solar";
                      navigator.clipboard.writeText(copyText);
                    }}
                    className="cursor-pointer"
                    title="Copy Email to Clipboard"
                  >
                    Click to email OCF at <span>support@quartz.solar</span>
                  </div>
                }
                position="middle"
                className={"text-right"}
                fullWidth
              >
                <a
                  id={"UserMenu-ContactBtn"}
                  href="mailto:support@quartz.solar?subject=Quartz%20Solar%20Support%20Request"
                >
                  Contact{" "}
                  <ExternalLinkIcon className="inline-block w-3 h-3 ml-[6px] mb-[1px] self-center text-inherit color-black" />
                </a>
              </Tooltip>
            </div>
          </Menu.Item>

          <Menu.Item>
            <div className="px-4 py-3 text-ocf-black-600 text-right">
              <a
                id={"UserMenu-FeedbackBtn"}
                href="https://docs.google.com/forms/d/e/1FAIpQLSf08XJPFwsNHxYiHUTV4g9CHWQzxAn0gSiAXXFkaI_3wjpNWw/viewform"
                target="_blank"
                rel="noreferrer"
              >
                Give feedback{" "}
                <ExternalLinkIcon className="inline-block w-3 h-3 ml-[6px] mb-[1px] self-center text-inherit color-black" />
              </a>
            </div>
          </Menu.Item>

          <div className="w-full border-t border-gray-300" />

          <div className="px-4 pt-3">
            <p id={"UserMenu-Version"} className="text-xs font-medium text-ocf-black-300 truncate">
              Version {version}
            </p>
          </div>
          <div id={"UserMenu-SignedInText"} className="px-4 py-3 border-b border-gray-300">
            <p className="text-xs text-ocf-black-300">Signed in as</p>
            <p className="text-xs font-medium text-ocf-black-300 truncate">{user && user.email}</p>
          </div>

          <Menu.Item>
            {({ active }) => (
              <div
                className={classNames(
                  active ? "bg-gray-100" : "",
                  "block px-4 py-2 text-sm text-ocf-black-600"
                )}
              >
                <Link href="/api/auth/logout" legacyBehavior>
                  <a id={"UserMenu-LogoutBtn"}>Sign out</a>
                </Link>
              </div>
            )}
          </Menu.Item>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

export default ProfileDropDown;
