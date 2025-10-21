import { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import Header from "../components/layout/header";
import { VIEWS } from "../constant";

const NotFoundPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Not found | Quartz Solar UI</title>
      </Head>
      <div className="bg-mapbox-black flex flex-col min-h-screen pt-16">
        <Header view={VIEWS.FORECAST} setView={() => {}} isLoggedIn={false} />
        <main className="flex flex-col justify-center flex-grow w-full px-4 mx-auto max-w-7xl sm:px-6 lg:px-8 text-white">
          <div className="py-16">
            <div className="text-center">
              <p className="text-sm font-semibold tracking-wide uppercase text-danube-600">
                404 error
              </p>
              <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ocf-gray-500 sm:text-5xl">
                Page not found.
              </h1>
              <p className="mt-2 py-3 text-base text-ocf-gray-700">
                Sorry, we couldn&apos;t find the page you&apos;re looking for.
              </p>
              <div className="mt-6">
                <Link
                  href="/"
                  className="text-sm self-center my-3 p-3 font-medium hover:cursor-pointer bg-ocf-gray-500 hover:bg-ocf-yellow-600 active:bg-ocf-yellow-600 text-black transition-all duration-200 py-2 px-4 rounded-full"
                >
                  Go back home<span aria-hidden="true"> &rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default NotFoundPage;
