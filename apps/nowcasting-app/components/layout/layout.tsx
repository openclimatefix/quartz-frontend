import Head from "next/head";
import { API_PREFIX } from "../../constant";
import { useLoadDataFromApi } from "../hooks/useLoadDataFromApi";
import { SolarStatus } from "../types";

interface ILayout {
  children: React.ReactNode;
  environment?: string;
}

const Layout = ({ children }: ILayout) => {
  const { data: solarStatus } = useLoadDataFromApi<SolarStatus>(`${API_PREFIX}/solar/GB/status?UI`);

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
