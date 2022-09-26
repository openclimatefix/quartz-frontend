import type { AppProps } from "next/app";
import { UserProvider } from "@auth0/nextjs-auth0";
import { ToastContainer, toast } from "react-toastify";
import "../styles/globals.css";
import { SWRConfig } from "swr";
import { apiErrorMSGS } from "../constant";
import * as Sentry from "@sentry/nextjs";
import { AxiosError } from "axios";

function MyApp({ Component, pageProps }: any) {
  return (
    <UserProvider>
      <SWRConfig
        value={{
          provider: () => new Map(),
          onError: (error: AxiosError, key) => {
            const isNetworkError = error.code === "ERR_NETWORK";
            if (
              !isNetworkError &&
              error.response?.status !== 404 &&
              error.response?.status !== 403
            ) {
              Sentry.captureException(error);
            }
            const defaultMsg = "Error fetching data. Retrying now…";
            const errorMsg = apiErrorMSGS.find((e) => key.match(e.key))?.getMsg(key);
            toast(errorMsg || defaultMsg, {
              type: "error",
              theme: "colored",
              icon: false
            });
          }
        }}
      >
        <ToastContainer position="top-left" autoClose={10000} limit={5} hideProgressBar={true} />

        <Component {...pageProps} />
      </SWRConfig>
    </UserProvider>
  );
}

export default MyApp;
