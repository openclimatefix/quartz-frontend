import Head from "next/head";
import { API_PREFIX, getViewTitle } from "../../constant";
import { useLoadDataFromApi } from "../hooks/useLoadDataFromApi";
import { SolarStatus } from "../types";
import useGlobalState from "../helpers/globalState";

interface ILayout {
  children: React.ReactNode;
  environment?: string;
}

const Layout = ({ children }: ILayout) => {
  const { data: solarStatus } = useLoadDataFromApi<SolarStatus>(`${API_PREFIX}/solar/GB/status`);
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
