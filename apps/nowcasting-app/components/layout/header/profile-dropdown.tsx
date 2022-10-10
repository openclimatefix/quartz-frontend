import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { useUser } from "@auth0/nextjs-auth0";
import pkg from "../../../package.json";
import { classNames } from "../../helpers/utils";
import Link from "next/link";
const { version } = pkg;

interface IProfileDropDown {}

const ProfileDropDown = ({}: IProfileDropDown) => {
  const { user } = useUser();

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
          <div className="px-4 pt-3">
            <p className="text-sm font-medium text-gray-900 truncate">Version {version}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-gray-900">Signed in as</p>
            <p className="text-sm font-medium text-gray-900 truncate">{user && user.email}</p>
          </div>
          <div className="w-full border-t border-gray-300" />
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

export default ProfileDropDown;
