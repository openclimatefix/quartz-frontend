import Head from "next/head";
import { Claims, withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout";

import { Button } from "@openclimatefix/nowcasting-ui";

export default function Home({ user }: { user: Claims }) {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-screen py-2">
        <Head>
          <title>Nowcasting App</title>
        </Head>

        <main className="flex flex-col items-center justify-center flex-1 w-full px-20 text-center">
          <h1 className="text-6xl font-bold">Welcome to Nowcasting.io</h1>
          <p className="mt-3 text-2xl">A better way to think about solar</p>
          <Button>It works</Button>
        </main>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
