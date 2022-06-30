import Head from "next/head";
import useSWR from "swr";
import { API_PREFIX } from "../constant";
import { axiosFetcher } from "./utils";

interface ILayout {
  children: React.ReactNode;
  environment?: string;
}

const Layout = ({ children }: ILayout) => {
  const { data: solarStatus, isValidating } = useSWR<{
    status: string;
    message: string;
  }>(`${API_PREFIX}/GB/solar/status`, axiosFetcher, {});

  return (
    <>
      <Head>
        <title>Solar PV Forecast</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="absolute inset-0 flex flex-col">
        {isValidating || solarStatus?.status === "ok" ? null : (
          <div className="blue text-white text-sm px-3 py-1" style={{ backgroundColor: "#48B0DF" }}>
            <p>
              {solarStatus?.message}
              Forecast has issues for regions in the North East of England from 12:00 20/6/22 We are
              working on a fix.
            </p>
          </div>
        )}
        {children}
      </main>
    </>
  );
};

export default Layout;
