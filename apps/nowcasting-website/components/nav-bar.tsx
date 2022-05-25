interface INavBar {}

import { Disclosure } from "@headlessui/react";
import { MenuIcon, XIcon } from "@heroicons/react/outline";
import Link from "next/link";

const navItems = [
  {
    name: "Challenge",
    href: "#challenge",
  },
  {
    name: "Solution",
    href: "#solution",
  },
  {
    name: "Technical",
    href: "#technical",
  },
  {
    name: "Open Source",
    href: "#open-source",
  },
  {
    name: "Open Climate Fix",
    href: "https://openclimatefix.org",
  },
];

const NavBar = ({}: INavBar) => {
  return (
    <Disclosure as="nav" className="fixed top-0 z-50 w-full bg-white shadow">
      {({ open }) => (
        <>
          <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex items-center mr-2 -ml-2 md:hidden">
                  {/* Mobile menu button */}
                  <Disclosure.Button className="inline-flex items-center justify-center p-2 text-gray-400 rounded-md hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
                    <span className="sr-only">Open main menu</span>
                    {open ? (
                      <XIcon className="block w-6 h-6" aria-hidden="true" />
                    ) : (
                      <MenuIcon className="block w-6 h-6" aria-hidden="true" />
                    )}
                  </Disclosure.Button>
                </div>
                <div className="flex items-center flex-shrink-0">
                  <Link href="/">
                    <a>
                      <img
                        className="w-auto h-8"
                        src="/nowcasting.svg"
                        alt="Nowcasting Logo"
                      />
                    </a>
                  </Link>
                </div>
                <div className="hidden md:ml-6 md:flex md:space-x-8">
                  {navItems.map(({ name, href }) => (
                    <a
                      href={href}
                      key={`main-nav-${href}`}
                      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    >
                      {name}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Disclosure.Panel className="md:hidden">
            <div className="pt-2 pb-3 space-y-1">
              {navItems.map(({ name, href }) => (
                <Disclosure.Button
                  as="a"
                  href={href}
                  key={`mobile-nav-${href}`}
                  className="block py-2 pl-3 pr-4 text-base font-medium text-gray-500 sm:pl-5 sm:pr-6 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
                >
                  {name}
                </Disclosure.Button>
              ))}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
};

export default NavBar;
