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
        <div className="w-full h-full flex-[5]">
          <PvLatestMap />
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
