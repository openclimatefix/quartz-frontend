import Head from "next/head";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout";
import { PvLatestMap } from "../components/map";
import SideLayout from "../components/side-layout";

export default function Home() {

  return (
    <Layout>
      <div className="h-full grid grid-cols-9">
        <SideLayout className="col-span-4">chart</SideLayout>
        <div className="w-full h-full mb-20 col-span-5">
        <PvLatestMap />
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
