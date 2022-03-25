import { NextPage } from "next";

import Layout from "../components/layout";
import BarLineChart from "../components/charts/barline";
import DataAttribution from "../components/data-attribution";
import { useRouter } from "next/router";
import useSWR from "swr";

const Vis4BarPage: NextPage = () => {
  // Add support for dynamic data
  const router = useRouter();
  const date = router.query.date || "2021-06-10";
  console.log(date);

  const fetcher = (...args) => fetch(...args).then((res) => res.json());
  // http://localhost:3000/api/gsp?time=2021-06-10T12:00&shape=circ
  const { data, error } = useSWR(`/api/generation-mix?date=${date}`, fetcher);

  if (error) return <div>failed to load</div>;
  if (!data) return <div>loading...</div>;

  // Continue as normal below

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
      <BarLineChart data={data} />
    </Layout>
  );
};

export default Vis4BarPage;
