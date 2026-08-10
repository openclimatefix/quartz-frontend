import Head from "next/head";
import { Analytics } from "@vercel/analytics/next";
import { getViewTitle, VIEWS } from "../../constant";
import { useFocusedCountry } from "../../hooks/data";
import { useSitesStatus, useSolarStatus } from "../hooks/useStatus";
import useGlobalState from "../helpers/globalState";
import StatusBanner from "./StatusBanner";

interface ILayout {
  children: React.ReactNode;
  environment?: string;
}

const Layout = ({ children }: ILayout) => {
  // Both status fetches carry a Scope even though neither backend consumes it yet — see
  // components/hooks/useStatus.ts for why.
  const country = useFocusedCountry();
  const { data: solarStatus } = useSolarStatus({
    country,
    source: "solar",
    regionType: "national"
  });
  const { data: sitesStatus } = useSitesStatus({ country, source: "solar", regionType: "site" });
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
