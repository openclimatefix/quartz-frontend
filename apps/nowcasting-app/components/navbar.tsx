import { Fragment } from "react";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import { useUser } from "@auth0/nextjs-auth0";
import { version } from "../package.json";

import { classNames } from "./utils";

interface INavbar {}

const Navbar = ({}: INavbar) => {
  const { user } = useUser();

  return (
    <>
      <Disclosure as="nav" className="bg-white shadow">
        <div className="mx-auto max-w-7xl  bg-black px-4">
          <div className="relative flex justify-between h-16">
            <div className="flex flex-1 items-stretch justify-start">
              <div className="flex items-center flex-shrink-0">
                <img
                  className="block w-auto h-7 "
                  src="/NOWCASTING_Secondary-white.svg"
                  alt="Nowcasting Logo"
                />
                <div className="text-xl p-4">- Alpha Release</div>
              </div>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
              {/* Profile dropdown */}
              <Menu as="div" className="relative z-20 ml-3">
                <div>
                  <Menu.Button className="flex text-sm bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-danube-500">
                    <span className="sr-only">Open user menu</span>
                    <img
                      className="w-8 h-8 rounded-full"
                      src={(user && user.picture) || ""}
                      alt=""
                    />
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
                  <Menu.Items className="absolute right-0 w-48 py-1 mt-2 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="px-4 pt-3">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        Version {version.slice(0, 3)}
                      </p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm text-gray-900">Signed in as</p>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user && user.email}
                      </p>
                    </div>
                    <div className="w-full border-t border-gray-300" />
                    <Menu.Item>
                      {({ active }) => (
                        <a
                          href="/api/auth/logout"
                          className={classNames(
                            active ? "bg-gray-100" : "",
                            "block px-4 py-2 text-sm text-gray-700",
                          )}
                        >
                          Sign out
                        </a>
                      )}
                    </Menu.Item>
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
          </div>
        </div>
      </Disclosure>
    </>
  );
};

export default Navbar;
