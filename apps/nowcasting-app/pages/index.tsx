import Head from "next/head";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout";
import { PvLatestMap } from "../components/map";

export default function Home() {

  return (
      <Layout>
        <div>
          <Head>
            <title>Nowcasting App</title>
          </Head>
          <main>
            <div className="w-full h-screen mb-20">
              <PvLatestMap />
            </div>
          </main>
        </div>
      </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
