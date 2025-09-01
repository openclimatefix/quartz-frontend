"use client";

import Link from "next/link";
import Head from "next/head";
import { useSearchParams } from "next/navigation";
import Header from "../../components/layout/header";
import { VIEWS } from "../../constant";

const AccessDeniedPage = ({ query }: { query: any }) => {
  // get query params from the URL server side
  const queryParams = useSearchParams();
  const errorDescription = queryParams.get("error_description");
  return (
    <>
      <Head>
        <title>Email Verification | Quartz Solar UI</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="bg-mapbox-black min-h-screen flex flex-col">
        <Header view={VIEWS.FORECAST} setView={() => {}} isLoggedIn={false} />
        <main className="w-full px-4 mx-auto max-w-lg sm:px-6 lg:px-8 flex-1 flex flex-col items-center justify-center">
          <div className="max-w-xl py-16 mx-auto sm:py-24 text-center gap-6 flex flex-col mt-2 text-lg text-white">
            <h1 className="text-4xl font-extrabold tracking-tight text-ocf-gray-500 sm:text-5xl">
              Nearly there.
            </h1>
            <p className="font-light">Please check your email for a verification link.</p>
            {errorDescription && errorDescription?.includes("Email not verified.") && (
              <p className="mt-3 bg-ocf-yellow/25 text-xs p-4 rounded-md">
                Hmm, it seems like you haven&apos;t verified your email address yet. Please check
                your inbox for a verification link.
              </p>
            )}
            <Link
              href="/"
              className="text-sm self-center my-3 py-2 px-4 font-medium hover:cursor-pointer bg-ocf-gray-500 hover:bg-ocf-yellow-600 active:bg-ocf-yellow-600 text-black transition-all duration-200 rounded-full"
            >
              I&apos;ve verified, continue<span aria-hidden="true"> &rarr;</span>
            </Link>
            <p className="text-sm text-gray-400">
              If you think this is a mistake, you have verified your email, and should have access,
              please contact the Quartz Solar team at{" "}
              <a
                href="mailto:support@quartz.solar"
                className="text-danube-600 underline hover:text-danube-800"
              >
                support@quartz.solar
              </a>
              .
            </p>
          </div>
        </main>
      </div>
    </>
  );
};

export default AccessDeniedPage;
