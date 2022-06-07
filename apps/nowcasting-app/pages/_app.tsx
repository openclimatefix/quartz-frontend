import type { AppProps } from "next/app";
import { UserProvider } from "@auth0/nextjs-auth0";

import "../styles/globals.css";
import { SWRConfig } from "swr";

function MyApp({ Component, pageProps }: any) {
  return (
    <UserProvider>
      <SWRConfig value={{ provider: () => new Map() }}>
        <Component {...pageProps} />
      </SWRConfig>
    </UserProvider>
  );
}

export default MyApp;
