import Head from "next/head";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout";
import { PvLatestMap } from "../components/map";
import SideLayout from "../components/side-layout";
import PvRemixChart from "../components/charts/pvRemixChart";

export default function Home() {
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
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
