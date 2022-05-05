import Head from "next/head";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import useSWR from "swr";

import Layout from "../components/layout";
import Map from "../components/map";
import ButtonGroup from "../components/button-group";

const fetcher = (input: RequestInfo, init: RequestInit) =>
  fetch(input, init).then((res) => res.json());

const API_PREFIX = "https://api-dev.nowcasting.io/v0";

export default function Home() {
  const { data: forecastData, error: forecastError } = useSWR(
    `${API_PREFIX}/GB/solar/gsp/forecast/all`,
    fetcher
  );

  if (forecastError) {
    console.log(forecastError);
    return <div>Failed to load</div>;
  }

  return (
    <Layout>
      <div>
        <Head>
          <title>Nowcasting App</title>
        </Head>

        <main className="pb-20">
          <div className="w-full h-screen mb-20">
            <Map
              loadDataOverlay={() => {}}
              controlOverlay={(map) => (
                <>
                  <ButtonGroup />
                </>
              )}
            />
          </div>

          <h1>
            Fetching real data from{" "}
            <a href={API_PREFIX} className="hover:underline">
              {API_PREFIX}
            </a>
            :
          </h1>
          <pre className="p-2 mt-4 text-white bg-gray-800 rounded-md">
            <code>{JSON.stringify(forecastData, null, 2)}</code>
          </pre>
        </main>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
