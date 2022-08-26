/*
Layout which includes
1. website title
2. website favicon
3. warning / error message
*/
import Head from "next/head";
import useSWR from "swr";
import { API_PREFIX } from "../constant";
import { axiosFetcher } from "./utils";

interface ILayout {
  children: React.ReactNode;
  environment?: string;
}

const Layout = ({ children }: ILayout) => {
  const { data: solarStatus } = useSWR<{
    status: string;
    message: string;
  }>(`${API_PREFIX}/GB/solar/status`, axiosFetcher, {
    refreshInterval: 60 * 1000 * 5, // 5min
  });

  return (
    <>
      <Head>
        <title>Solar PV Forecast</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="absolute inset-0 flex flex-col h-screen">
        {!solarStatus || solarStatus?.status === "ok" ? null : (
          <div className="blue text-white text-m px-4 py-2" style={{ backgroundColor: "#48B0DF" }}>
            <p>{solarStatus?.message}</p>
          </div>
        )}
        {children}
      </main>
    </>
  );
};

export default Layout;
