"use client";

import Link from "next/link";
import Head from "next/head";
import { useSearchParams } from "next/navigation";
import Header from "../components/layout/header";
import { VIEWS } from "../constant";

const TrialExpiredPage = () => {
  const queryParams = useSearchParams();
  const email = queryParams.get("email");
  return (
    <>
      <Head>
        <title>Trial Expired | Quartz Solar UI</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="bg-mapbox-black min-h-screen flex flex-col">
        <Header view={VIEWS.FORECAST} setView={() => {}} isLoggedIn={false} />
        <main className="w-full px-4 mx-auto max-w-2xl sm:px-6 lg:px-8 flex-1 flex flex-col items-center justify-center">
          <div className="max-w-xl py-16 mx-auto sm:py-24 text-center gap-4 flex flex-col mt-2 text-lg text-white">
            <p className="font-light">Your Quartz Solar trial has now ended.</p>
            <h1 className="text-4xl font-extrabold tracking-tight mb-8 text-ocf-gray-500 sm:text-5xl">
              So, how did it go?
            </h1>
            <p className="text-sm text-gray-400">
              Ready to subscribe, or need some more time to evaluate? No problem.
            </p>
            <div className="flex items-center justify-center gap-8">
              <Link
                href={`mailto:support@quartz.solar?subject=${encodeURIComponent(
                  `Trial extension request for user ${email}`
                )}`}
                className="text-sm self-center my-3 py-2 px-4 font-medium hover:cursor-pointer bg-ocf-gray-500 hover:bg-ocf-yellow-600 active:bg-ocf-yellow-600 text-black transition-all duration-200 rounded-full"
              >
                Contact us to extend your trial &nbsp;↺
              </Link>
              <Link
                href={`mailto:support@quartz.solar?subject=${encodeURIComponent(
                  `Subscription request for user ${email}`
                )}`}
                className="text-sm self-center my-3 py-2 px-4 font-medium hover:cursor-pointer bg-ocf-yellow hover:bg-ocf-yellow-600 active:bg-ocf-yellow-600 text-black transition-all duration-200 rounded-full"
              >
                Subscribe now &nbsp;→
              </Link>
            </div>
            <p className="text-sm text-gray-400">
              Any questions, as always contact us at{" "}
              <a
                href="mailto:support@quartz.solar"
                className="text-danube-600 underline hover:text-danube-800"
              >
                support@quartz.solar
              </a>
            </p>
          </div>
        </main>
      </div>
    </>
  );
};

export default TrialExpiredPage;
