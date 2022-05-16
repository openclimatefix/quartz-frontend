import Head from "next/head";

import Footer from "./footer";
import Navbar from "./navbar";

interface ILayout {
  children: React.ReactNode;
}

const Layout = ({ children }: ILayout) => {
  return (
    <>
      <Head>
        <title>Nowcasting App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="absolute inset-0 flex flex-col	">
        <Navbar />
        {children}
      </main>
    </>
  );
};

export default Layout;
