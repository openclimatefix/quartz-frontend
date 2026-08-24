import Head from "next/head";
import { Analytics } from "@vercel/analytics/next";
import { getViewTitle } from "../../constant";
import { useProductStatuses } from "../hooks/useStatus";
import useGlobalState from "../helpers/globalState";
import StatusBanner from "./StatusBanner";

interface ILayout {
  children: React.ReactNode;
  environment?: string;
}

const Layout = ({ children }: ILayout) => {
  // Every product the user is entitled to, in one call. The banner is no longer scoped to
  // the current view: an outage on a product the user is not looking at is still worth
  // knowing about, and dropping the view dependency keeps this file out of the way of the
  // Europe UI work, which replaces `view` with `isSitesChart` + `comparison`.
  const statuses = useProductStatuses();
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
        <StatusBanner statuses={statuses} />
        {children}
        <Analytics />
      </main>
    </>
  );
};

export default Layout;
