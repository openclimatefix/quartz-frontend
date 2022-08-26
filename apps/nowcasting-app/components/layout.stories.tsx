/*
Note sure this is used #TODO check
*/
import Layout from "./layout";

export default {
  title: "Components/Layout",
  component: Layout as any,
};

export const LayoutComponent = () => (
  <Layout environment="local">
    <h1>Hello</h1>
  </Layout>
);
