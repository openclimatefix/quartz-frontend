import { NextPage } from "next";
import Head from "next/head";
import Footer from "../components/footer";

const NotFoundPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Not found | Nowcasting App</title>
      </Head>
      <div className="flex flex-col min-h-screen pt-16">
        <main className="flex flex-col justify-center flex-grow w-full px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex justify-center flex-shrink-0">
            <a href="/" className="inline-flex">
              <span className="sr-only">Workflow</span>
              <img
                className="w-auto h-12"
                src="https://nowcasting.io/nowcasting.svg"
                alt="Nowcasting Logo"
              />
            </a>
          </div>
          <div className="py-16">
            <div className="text-center">
              <p className="text-sm font-semibold tracking-wide uppercase text-danube-600">
                404 error
              </p>
              <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
                Page not found.
              </h1>
              <p className="mt-2 text-base text-gray-500">
                Sorry, we couldn’t find the page you’re looking for.
              </p>
              <div className="mt-6">
                <a href="/" className="text-base font-medium text-danube-600 hover:text-danube-500">
                  Go back home<span aria-hidden="true"> &rarr;</span>
                </a>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default NotFoundPage;
