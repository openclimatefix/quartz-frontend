import Head from "next/head";

interface ILayout {
  children: React.ReactNode;
}

const Layout = ({ children }: ILayout) => {
  return (
    <>
      <Head>
        <title>Nowcasting</title>
      </Head>
      <div className="absolute inset-0 flex flex-col">
        <div className="flex-grow">{children}</div>
        <h1 className="py-2 text-2xl text-center text-white border-t border-white bg-mapbox-black">
          June 10th, 2021
        </h1>
      </div>
    </>
  );
};

export default Layout;
