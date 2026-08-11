import Head from "next/head";
import { Analytics } from "@vercel/analytics/next";
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
  const [isSitesChart] = useGlobalState("isSitesChart");
  const [comparison] = useGlobalState("comparison");
  // Replaces `getViewTitle(view)` (Wave 4): the three titles it produced — "PV Forecast",
  // "Delta", "Solar Sites" — now come from the two facts that used to be folded into `view`,
  // route and comparison, rather than from a third piece of state mirroring both.
  const viewTitle = isSitesChart ? "Solar Sites" : comparison ? "Delta" : "PV Forecast";
  const pageTitle = `Quartz Solar - ${viewTitle}`;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex flex-col h-screen">
        <StatusBanner
          isSitesChart={isSitesChart}
          solarStatus={solarStatus}
          sitesStatus={sitesStatus}
        />
        {children}
        <Analytics />
      </main>
    </>
  );
};

export default Layout;
