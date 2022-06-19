import type { AppProps } from "next/app";
import { UserProvider } from "@auth0/nextjs-auth0";
import { ToastContainer, toast } from "react-toastify";
import "../styles/globals.css";
import { SWRConfig } from "swr";

function MyApp({ Component, pageProps }: any) {
  return (
    <UserProvider>
      <SWRConfig
        value={{
          provider: () => new Map(),
          onError: (error, key) => {
            toast("Error fetching data. Retrying now…", {
              type: "error",
              theme: "colored",
              icon: false,
            });
          },
        }}
      >
        <ToastContainer position="top-left" autoClose={10000} limit={5} hideProgressBar={true} />

        <Component {...pageProps} />
      </SWRConfig>
    </UserProvider>
  );
}

export default MyApp;
