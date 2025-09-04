import { NextPage } from "next";
import Head from "next/head";

import { ChevronRightIcon } from "@heroicons/react/solid";
import { BookOpenIcon, SupportIcon, ViewListIcon } from "@heroicons/react/outline";
import Link from "next/link";
import Header from "../components/layout/header";
import { VIEWS } from "../constant";

const links = [
  {
    title: "Documentation",
    description: "Learn how to integrate our tools with your app",
    icon: BookOpenIcon,
    url: "https://openclimatefix.notion.site/Quartz-Solar-Documentation-0d718915650e4f098470d695aa3494bf"
  },
  {
    title: "API Reference",
    description: "A complete API reference for our library",
    icon: ViewListIcon,
    url: "https://api.quartz.solar/docs"
  },
  {
    title: "Support",
    description: "Get help with any problems you encounter",
    icon: SupportIcon,
    url: "mailto:support@quartz.solar?subject=Quartz%20Solar%20Support%20Request"
  }
];

const LogoutPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Logged out | Quartz Solar UI</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="bg-mapbox-black min-h-screen w-full mx-auto flex flex-col items-center">
        <Header view={VIEWS.FORECAST} setView={() => {}} isLoggedIn={false} />
        <div className="flex-1 flex flex-col items-center justify-center mt-16 px-4 py-4 max-w-7xl sm:px-6 lg:px-8 mx-auto sm:py-24 text-white">
          <div className="text-center">
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ocf-gray-500 sm:text-5xl">
              See you next time.
            </h1>
            <p className="mt-2 text-lg text-ocf-gray-700">You have successfully logged out.</p>
            <div className="mt-4 cursor-pointer">
              <Link href="/" className="text-xs font-medium hover:cursor-pointer">
                <button
                  type="submit"
                  name="action"
                  value="default"
                  className="text-sm self-center my-3 p-3 font-medium hover:cursor-pointer bg-ocf-gray-500 hover:bg-ocf-yellow-600 active:bg-ocf-yellow-600 text-black transition-all duration-200 py-2 px-4 rounded-full"
                >
                  Log back in.<span aria-hidden="true"> &rarr;</span>
                </button>
              </Link>
            </div>
          </div>

          <div className="mt-16">
            <h2 className="text-sm font-semibold tracking-wide text-ocf-gray-500 uppercase">
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
                    <h3 className="text-base font-medium text-ocf-gray-500">
                      <span className="rounded-sm focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-danube-500">
                        <a href={link.url} className="focus:outline-none">
                          <span className="absolute inset-0" aria-hidden="true" />
                          {link.title}
                        </a>
                      </span>
                    </h3>
                    <p className="text-base text-ocf-gray-700">{link.description}</p>
                  </div>
                  <div className="self-center flex-shrink-0 pl-6">
                    <ChevronRightIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </>
  );
};

export default LogoutPage;
