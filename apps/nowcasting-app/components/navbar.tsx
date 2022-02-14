import { Fragment } from "react";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import { useUser } from "@auth0/nextjs-auth0";

import { classNames } from "./utils";

interface INavbar {
  environment: "local" | "dev";
}

const Navbar = ({ environment }: INavbar) => {
  const { user } = useUser();

  return (
    <>
      <Disclosure as="nav" className="bg-white shadow">
        <div className="px-2 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="relative flex justify-between h-16">
            <div className="flex items-center justify-center flex-1 sm:items-stretch sm:justify-start">
              <div className="flex items-center flex-shrink-0">
                <img
                  className="block w-auto h-7 lg:hidden"
                  src="https://nowcasting.io/nowcasting.svg"
                  alt="Nowcasting Logo"
                />
                <img
                  className="hidden w-auto h-7 lg:block"
                  src="https://nowcasting.io/nowcasting.svg"
                  alt="Nowcasting Logo"
                />
              </div>
              <div className="hidden py-2 sm:ml-6 sm:flex sm:space-x-8">
                <div
                  className={classNames(
                    environment === "local"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-900 hover:bg-gray-50 hover:text-gray-900",
                    "rounded-md py-2 px-3 inline-flex items-center text-sm font-medium"
                  )}
                >
                  {environment}
                </div>
              </div>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
              {/* Profile dropdown */}
              <Menu as="div" className="relative ml-3">
                <div>
                  <Menu.Button className="flex text-sm bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500">
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
                    <div className="px-4 py-3">
                      <p className="text-sm">Signed in as</p>
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
                            "block px-4 py-2 text-sm text-gray-700"
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
