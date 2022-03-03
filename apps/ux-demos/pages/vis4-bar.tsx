import { NextPage } from "next";

import Layout from "../components/layout";
import BarLineChart from "../components/charts/barline";

const Vis4BarPage: NextPage = () => {
  return (
    <Layout>
      <BarLineChart />
    </Layout>
  );
};

export default Vis4BarPage;
