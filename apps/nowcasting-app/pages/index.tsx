import Head from "next/head";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout";

import useSWR from "swr";

const fetcher = (input: RequestInfo, init: RequestInit) =>
  fetch(input, init).then((res) => res.json());

const API_PREFIX_LOCAL = "/api";
const API_PREFIX_REMOTE = "https://api.nowcasting.io/v0";
const API_PREFIX = API_PREFIX_LOCAL;

export default function Home() {
  const { data, error } = useSWR(`${API_PREFIX}/forecasts/GB/pv/gsp`, fetcher);

  if (error) {
    console.log(error);
    return <div>Failed to load</div>;
  }

  return (
    <Layout>
      <div className="container min-h-screen">
        <Head>
          <title>Nowcasting App</title>
        </Head>

        <main className="pt-12">
          <h1 className="mb-6 text-3xl font-bold leading-tight text-gray-900">
            API Response
          </h1>

          {!data ? (
            <p>Loading...</p>
          ) : (
            <pre className="p-2 rounded-md bg-slate-800 text-slate-200">
              <code>{JSON.stringify(data, null, 2)}</code>
            </pre>
          )}
        </main>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
