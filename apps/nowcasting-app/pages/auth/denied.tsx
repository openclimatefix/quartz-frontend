"use client";

import Link from "next/link";
import Head from "next/head";
import { useSearchParams } from "next/navigation";
import Header from "../../components/layout/header";
import { useEffect, useState } from "react";

const AccessDeniedPage = ({ query }: { query: any }) => {
  // get query params from the URL server side
  const queryParams = useSearchParams();
  const errorDescription = queryParams.get("error_description");
  const [hasVisited, setHasVisited] = useState(false);
  useEffect(() => {
    //   If the user has a cookie saying they have visited before, set hasVisited to true
    if (document.cookie.includes("visited_access_denied=true")) {
      setHasVisited(true);
    } else {
      //   If first time visiting the page, set a cookie to remember they have been here
      document.cookie = "visited_access_denied=true; path=/; max-age=3600"; // 1 hour
    }
  }, []);
  const isEmailVerification = errorDescription?.includes("Email not verified");

  return (
    <>
      <Head>
        <title>
          {isEmailVerification ? "Email Verification" : "Access Denied"} | Quartz Solar UI
        </title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="bg-surface-sunken min-h-screen flex flex-col">
        <Header isLoggedIn={false} />
        <main className="w-full px-4 mx-auto max-w-lg sm:px-6 lg:px-8 flex-1 flex flex-col items-center justify-center">
          <div className="max-w-xl py-16 mx-auto sm:py-24 text-center gap-6 flex flex-col mt-2 text-lg text-content">
            {isEmailVerification ? (
              <>
                <h1 className="text-4xl font-extrabold tracking-tight text-content-secondary sm:text-5xl">
                  Nearly there.
                </h1>
                <p className="font-light">Please check your email for a verification link.</p>
                {hasVisited && (
                  <p className="mt-3 bg-interactive/25 text-xs p-4 rounded-md leading-relaxed">
                    Hmm, it seems like you haven&apos;t verified your email address yet. <br />
                    Please check your inbox for a verification link.
                  </p>
                )}
                <Link
                  href={`/`}
                  className="text-sm self-center my-3 py-2 px-4 font-medium hover:cursor-pointer bg-content-secondary hover:bg-interactive-hover active:bg-interactive-hover text-content-on-accent transition-all duration-200 rounded-full"
                >
                  I&apos;ve verified, continue<span aria-hidden="true"> &rarr;</span>
                </Link>
                <p className="text-sm text-content-muted">
                  If you think this is a mistake, please contact the Quartz Solar team at{" "}
                  <a
                    href="mailto:support@quartz.solar"
                    className="text-danube-600 underline hover:text-danube-800"
                  >
                    support@quartz.solar
                  </a>
                  .
                </p>
              </>
            ) : (
              <>
                <h1 className="text-4xl font-extrabold tracking-tight text-content-secondary sm:text-5xl">
                  Access denied.
                </h1>
                <p className="font-light">
                  Your account does not currently have access to Quartz Solar.
                </p>
                <p className="text-sm text-content-muted">
                  If you think this is a mistake, please contact us at{" "}
                  <a
                    href="mailto:support@quartz.solar"
                    className="text-danube-600 underline hover:text-danube-800"
                  >
                    support@quartz.solar
                  </a>
                  .
                </p>
                <Link
                  href="/api/auth/logout?redirectToLogin=true"
                  className="text-sm self-center my-3 py-2 px-4 font-medium hover:cursor-pointer bg-content-secondary hover:bg-interactive-hover active:bg-interactive-hover text-content-on-accent transition-all duration-200 rounded-full"
                >
                  Sign out<span aria-hidden="true"> &rarr;</span>
                </Link>
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default AccessDeniedPage;
