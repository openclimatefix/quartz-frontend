import type { NextPage } from "next";
import Head from "next/head";
import { SVGProps } from "react";

const Home: NextPage = () => {
  const taglineText =
    "Forecasting solar power production is hard - but it doesn't need to be! Get reliable forecasts now, powered by cutting-edge Machine Learning.";
  const footerNavigation = [
    {
      name: "Twitter",
      href: "https://twitter.com/openclimatefix",
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
          <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
        </svg>
      ),
    },
    {
      name: "GitHub",
      href: "https://github.com/openclimatefix",
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
          <path
            fillRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  ];

  return (
    <>
      <Head>
        <title>Nowcasting - A Better Way to Think about Solar</title>
        <meta name="description" content={taglineText} />
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </Head>

      <div className="pb-8 bg-white sm:pb-12 lg:pb-12">
        <div className="pt-8 overflow-hidden sm:pt-12 lg:relative lg:py-48">
          <div className="max-w-md px-4 mx-auto sm:max-w-3xl sm:px-6 lg:px-8 lg:max-w-7xl lg:grid lg:grid-cols-2 lg:gap-24">
            <div>
              <div>
                <img
                  className="w-auto h-9"
                  src="/nowcasting.svg"
                  alt="Workflow"
                />
              </div>
              <div className="mt-20">
                <div className="mt-6 sm:max-w-xl">
                  <h1 className="">
                    <span className="block ml-1 text-sm font-semibold tracking-wide text-gray-500 uppercase sm:text-base lg:text-sm xl:text-base">
                      Coming soon
                    </span>
                    <span className="block mt-1 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
                      A better way to think about solar
                    </span>
                  </h1>
                  <p className="mt-6 text-xl text-gray-500">{taglineText}</p>
                </div>
                <div className="mt-12">
                  <p className="text-base font-medium text-gray-900">
                    Sign up to get notified when it’s ready.
                  </p>
                  <form
                    action="https://openclimatefix.us20.list-manage.com/subscribe/post?u=ceb017fe32f0a4620227fda8a&amp;id=b88570c490"
                    method="post"
                    id="mc-embedded-subscribe-form"
                    name="mc-embedded-subscribe-form"
                    target="_blank"
                    noValidate
                    className="mt-3 sm:max-w-lg sm:w-full sm:flex"
                  >
                    <div className="flex-1 min-w-0">
                      <label htmlFor="mce-EMAIL" className="sr-only">
                        Email address
                      </label>
                      <input
                        id="mce-EMAIL"
                        type="email"
                        name="EMAIL"
                        className="block w-full px-5 py-3 text-base text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Enter your email"
                      />
                    </div>
                    <div className="mt-4 sm:mt-0 sm:ml-3">
                      <button
                        type="submit"
                        className="block w-full px-5 py-3 text-base font-medium bg-yellow-500 border border-transparent rounded-md shadow hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 sm:px-10"
                      >
                        Notify me
                      </button>
                    </div>
                    {/* real people should not fill this in and expect good things - do not remove this or risk form bot signups */}
                    <div className="absolute -left-96" aria-hidden="true">
                      <input
                        type="text"
                        name="b_ceb017fe32f0a4620227fda8a_b88570c490"
                        tabIndex={-1}
                      />
                    </div>
                    <input
                      type="checkbox"
                      id="gdpr_58391"
                      name="gdpr[58391]"
                      value="Y"
                      checked
                      className="hidden"
                      tabIndex={-1}
                    />
                  </form>
                  <p className="mt-3 text-sm text-gray-500">
                    We care about the protection of your data. Read our{" "}
                    <a
                      href="https://www.iubenda.com/privacy-policy/92003532"
                      target="_blank"
                      className="font-medium text-gray-900 underline"
                    >
                      Privacy Policy
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="sm:mx-auto sm:max-w-3xl sm:px-6">
            <div className="py-12 sm:relative sm:mt-12 sm:py-16 lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
              <div className="hidden sm:block">
                <div className="absolute inset-y-0 w-screen left-1/2 bg-gray-50 rounded-l-3xl lg:left-80 lg:right-0 lg:w-full" />
                <svg
                  className="absolute -mr-3 top-8 right-1/2 lg:m-0 lg:left-0"
                  width={404}
                  height={392}
                  fill="none"
                  viewBox="0 0 404 392"
                >
                  <defs>
                    <pattern
                      id="837c3e70-6c3a-44e6-8854-cc48c737b659"
                      x={0}
                      y={0}
                      width={20}
                      height={20}
                      patternUnits="userSpaceOnUse"
                    >
                      <rect
                        x={0}
                        y={0}
                        width={4}
                        height={4}
                        className="text-gray-200"
                        fill="currentColor"
                      />
                    </pattern>
                  </defs>
                  <rect
                    width={404}
                    height={392}
                    fill="url(#837c3e70-6c3a-44e6-8854-cc48c737b659)"
                  />
                </svg>
              </div>
              <div className="relative pl-4 -mr-40 sm:mx-auto sm:max-w-3xl sm:px-0 lg:max-w-none lg:h-full lg:pl-12">
                <img
                  className="w-full rounded-md shadow-xl ring-1 ring-black ring-opacity-5 lg:h-full lg:w-auto lg:max-w-none"
                  src="/solarpanels.jpg"
                  alt=""
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-white">
        <div className="px-4 py-12 mx-auto max-w-7xl sm:px-6 md:flex md:items-center md:justify-between lg:px-8">
          <div className="flex justify-center space-x-6 md:order-2">
            {footerNavigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">{item.name}</span>
                <item.icon className="w-6 h-6" aria-hidden="true" />
              </a>
            ))}
          </div>
          <div className="mt-8 md:mt-0 md:order-1">
            <p className="text-base text-center text-gray-400">
              &copy; 2021{" "}
              <a className="py-2" href="https://openclimatefix.org/">
                Open Climate Fix
              </a>{" "}
              Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Home;
