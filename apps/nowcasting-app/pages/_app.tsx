import "../styles/globals.css";
import { SWRConfig } from "swr";
import * as Sentry from "@sentry/nextjs";
import { AxiosError } from "axios";
import { GoogleTagManager } from "@next/third-parties/google";
import CustomUserProvider from "../components/auth/CustomUserProvider";

function MyApp({ Component, pageProps }: any) {
  return (
    <CustomUserProvider>
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
            console.log("error", key, error);
          }
        }}
      >
        <Component {...pageProps} />
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID || ""} />
      </SWRConfig>
    </CustomUserProvider>
  );
}

export default MyApp;
