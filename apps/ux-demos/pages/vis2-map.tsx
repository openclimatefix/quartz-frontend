import { NextPage } from "next";
import dynamic from "next/dynamic";
import Layout from "../components/layout";

const DynamicSolarMapWithNoSSR = dynamic(
  () => import("../components/solar-map"),
  { ssr: false }
);

const Vis2MapPage: NextPage = () => {
  return (
    <>
      <Layout>
        <div className="h-full">
          <DynamicSolarMapWithNoSSR />
        </div>
      </Layout>
    </>
  );
};

export default Vis2MapPage;
