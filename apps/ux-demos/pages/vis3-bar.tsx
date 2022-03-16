import { NextPage } from "next";

import Layout from "../components/layout";
import BarLineChart from "../components/charts/barline";
import DataAttribution from "../components/data-attribution";

const Vis4BarPage: NextPage = () => {
  return (
    <Layout title="Generation Mix with Demand">
      <DataAttribution
        style="black"
        datasets={[
          {
            title: "Generation by Fuel Type",
            sourceName: "Elexon BMRS",
            sourceUrl:
              "https://www2.bmreports.com/bmrs/?q=generation/fueltype/current",
            displayedWhere: "Bar Chart (bars)",
            isPublic: true,
          },
          {
            title: "Rolling System Demand",
            sourceName: "Elexon BMRS",
            sourceUrl:
              "https://www2.bmreports.com/bmrs/?q=demand/rollingsystemdemand/historic",
            displayedWhere: "Bar Chart (line)",
            isPublic: true,
          },
        ]}
      />
      <BarLineChart />
    </Layout>
  );
};

export default Vis4BarPage;
