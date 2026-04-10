import Head from "next/head";
import { Analytics } from "@vercel/analytics/next";
import { API_PREFIX, SITES_API_PREFIX, getViewTitle, VIEWS } from "../../constant";
import { useLoadDataFromApi } from "../hooks/useLoadDataFromApi";
import { SolarStatus } from "../types";
import useGlobalState from "../helpers/globalState";
import StatusBanner from "./StatusBanner";

interface ILayout {
  children: React.ReactNode;
  environment?: string;
}

const Layout = ({ children }: ILayout) => {
  const { data: solarStatus } = useLoadDataFromApi<SolarStatus>(`${API_PREFIX}/solar/GB/status`);
  const { data: sitesStatus } = useLoadDataFromApi<SolarStatus>(`${SITES_API_PREFIX}/api_status`);
  const [view] = useGlobalState("view");
  const viewTitle = getViewTitle(view);
  const pageTitle = view && viewTitle ? `Quartz Solar - ${viewTitle}` : "Quartz Solar";

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex flex-col h-screen">
        <StatusBanner view={view} solarStatus={solarStatus} sitesStatus={sitesStatus} />
        {children}
        <Analytics />
      </main>
    </>
  );
};

export default Layout;
