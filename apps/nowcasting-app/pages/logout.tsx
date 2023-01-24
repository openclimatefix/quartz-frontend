import { NextPage } from "next";
import Head from "next/head";

import { ChevronRightIcon } from "@heroicons/react/solid";
import { SupportIcon, BookOpenIcon, ViewListIcon } from "@heroicons/react/outline";
import Footer from "../components/layout/footer";
import Link from "next/link";

const links = [
  {
    title: "Documentation",
    description: "Learn how to integrate our tools with your app",
    icon: BookOpenIcon,
    url: "#"
  },
  {
    title: "API Reference",
    description: "A complete API reference for our library",
    icon: ViewListIcon,
    url: "https://api.nowcasting.io/docs"
  },
  {
    title: "Support",
    description: "Get help with any problems you encounter",
    icon: SupportIcon,
    url: "#"
  }
];

const LogoutPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Logged out | Nowcasting App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="bg-white">
        <main className="w-full px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex-shrink-0 pt-16">
            <img
              className="w-auto h-12 mx-auto"
              src="https://nowcasting.io/nowcasting.svg"
              alt="Nowcasting Logo"
            />
          </div>
          <div className="max-w-xl py-16 mx-auto sm:py-24">
            <div className="text-center">
              <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
                See you next time.
              </h1>
              <p className="mt-2 text-lg text-gray-500">You have successfully logged out.</p>
 <div className="mt-4 cursor-pointer">
                <Link
                  href="/"
                  className="text-xs font-medium hover:cursor-pointer"
                >
                  <button type="submit" name="action" value="default" className="bg-ocf-gray-500 hover:bg-ocf-yellow-400 active:bg-ocf-yellow-600 transition duration-200 py-1 px-3 rounded-full">
                    Log back in.<span aria-hidden="true"> &rarr;</span>
                    </button>
                </Link>
              </div>
            </div>

            <div className="mt-16">
              <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
                Popular pages
              </h2>
              <ul
                role="list"
                className="mt-4 border-t border-b border-gray-200 divide-y divide-gray-200"
              >
                {links.map((link, linkIdx) => (
                  <li key={linkIdx} className="relative flex items-start py-6 space-x-4">
                    <div className="flex-shrink-0">
                      <span className="flex items-center justify-center w-12 h-12 rounded-lg bg-danube-50">
                        <link.icon className="w-6 h-6 text-danube-700" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-medium text-gray-900">
                        <span className="rounded-sm focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-danube-500">
                          <a href={link.url} className="focus:outline-none">
                            <span className="absolute inset-0" aria-hidden="true" />
                            {link.title}
                          </a>
                        </span>
                      </h3>
                      <p className="text-base text-gray-500">{link.description}</p>
                    </div>
                    <div className="self-center flex-shrink-0">
                      <ChevronRightIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
                    </div>
                  </li>
                ))}
              </ul>
             
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default LogoutPage;
