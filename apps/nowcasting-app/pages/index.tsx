import Head from "next/head";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout";
import { PvLatestMap } from "../components/map";
import SideLayout from "../components/side-layout";
import PvRemixChart from "../components/charts/pv-remix-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";

export default function Home() {
  useAndUpdateSelectedTime();
  return (
    <Layout>
      <div className="h-full flex">
        <SideLayout className="flex-[4]">
          <PvRemixChart />
        </SideLayout>
        <div className="w-full h-full mb-20 flex-[5]">
          <PvLatestMap />
        </div>
      </div>
      <a
        className="bg-black text-white text-sm py-2 px-3"
        href="https://docs.google.com/forms/d/e/1FAIpQLSf08XJPFwsNHxYiHUTV4g9CHWQzxAn0gSiAXXFkaI_3wjpNWw/viewform"
        target="_blank"
        rel="noreferrer"
      >
        Give Feedback
      </a>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
