import { NextPage } from "next";
import Link from "next/link";
import Layout from "../components/layout";

const DayOverviewPage: NextPage = () => {
  return (
    <Layout>
      <div className="grid w-full h-full grid-cols-2 gap-6 p-6">
        <Link href="/vis1-map">
          <a className="flex border border-black cursor-pointer hover:bg-gray-200">
            <div className="w-full my-auto text-center">
              <h2 className="text-4xl">Forecasts for Individual PV Systems</h2>
              <p className="pt-2 text-lg">
                Output by PV system, combined with forecast error.
              </p>
            </div>
          </a>
        </Link>
        <Link href="/vis2-map">
          <a className="flex border border-black cursor-pointer hover:bg-gray-200">
            <div className="w-full my-auto text-center">
              <h2 className="text-4xl">Forecast Error Grouped by GSP</h2>
            </div>
          </a>
        </Link>
        <Link href="/vis4-bar">
          <a className="flex border border-black cursor-pointer hover:bg-gray-200">
            <div className="w-full my-auto text-center">
              <h2 className="text-4xl">Generation Mix with Demand</h2>
            </div>
          </a>
        </Link>
      </div>
    </Layout>
  );
};

export default DayOverviewPage;