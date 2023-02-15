import React, { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { useUser } from "@auth0/nextjs-auth0";
// import { version } from "@openclimatefix/nowcasting-ui.config.package-json";
import {
  classNames,
  formatISODateStringHumanNumbersOnly
} from "@openclimatefix/nowcasting-ui.helpers.utils";
import Link from "next/link";
import { Tooltip } from "@openclimatefix/nowcasting-ui.misc.tooltip";
import { useGlobalState } from "@openclimatefix/nowcasting-ui.helpers.global-state";
import { ChartInfo } from "@openclimatefix/nowcasting-ui.misc.chart-info";
import { ExternalLinkIcon } from "@openclimatefix/nowcasting-ui.icons.icons";

interface IProfileDropDown {
  version: string;
}

export const ProfileDropDown = ({ version }: IProfileDropDown) => {
  const { user } = useUser();
  const [show4hView, setShow4hView] = useGlobalState("show4hView");
  const isStaging = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production";

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
        <Menu.Items className="absolute right-0 top-12 w-48 py-1 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <Menu.Item>
            <div className="px-4 pt-2 text-ocf-black-600 text-right">
              <Tooltip tip={<ChartInfo />} position="left" className={"text-right"} fullWidth>
                Data
              </Tooltip>
            </div>
          </Menu.Item>
          <Menu.Item>
            <div className="px-4 pt-3 text-ocf-black-600 text-right">
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
                    Click to email OCF at <span>ops@openclimatefix.org</span>
                  </div>
                }
                position="left"
                className={"text-right"}
                fullWidth
              >
                <a href="mailto:ops@openclimatefix.org?subject=Nowcasting%20Feedback">
                  Help{" "}
                  <ExternalLinkIcon className="inline-block w-3 h-3 ml-[6px] mb-[1px] self-center text-inherit color-black" />
                </a>
              </Tooltip>
            </div>
          </Menu.Item>
          <Menu.Item>
            <div className="px-4 py-3 text-ocf-black-600 text-right">
              <a
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
            <p className="text-xs font-medium text-ocf-black-300 truncate">Version {version}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-ocf-black-300">Signed in as</p>
            <p className="text-xs font-medium text-ocf-black-300 truncate">{user && user.email}</p>
          </div>
          <div className="w-full border-t border-gray-300" />
          {isStaging && (
            <Menu.Item>
              {({ active }) => (
                <div
                  className={classNames(
                    active ? "bg-gray-100" : "",
                    "block px-4 py-2 text-sm text-gray-700"
                  )}
                >
                  <button
                    onClick={() => setShow4hView(!show4hView)}
                    className="ml-3 text-sx  font-medium text-ocf-black-300 dark:text-gray-300"
                  >
                    {`${show4hView ? "Hide" : "Show"} 4-hour forecast`}
                  </button>
                </div>
              )}
            </Menu.Item>
          )}
          <Menu.Item>
            {({ active }) => (
              <div
                className={classNames(
                  active ? "bg-gray-100" : "",
                  "block px-4 py-2 text-sm text-gray-700"
                )}
              >
                <Link href="/api/auth/logout">
                  <a>Sign out</a>
                </Link>
              </div>
            )}
          </Menu.Item>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};
