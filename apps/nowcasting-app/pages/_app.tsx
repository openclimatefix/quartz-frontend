import "../styles/globals.css";
import { SWRConfig } from "swr";
import * as Sentry from "@sentry/nextjs";
import { AxiosError } from "axios";
import { GoogleTagManager } from "@next/third-parties/google";
import CustomUserProvider from "../components/auth/CustomUserProvider";
import Router from "next/router";

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
            if (error && String(error).includes("not_authenticated")) {
              const router = Router;
              router.push("/api/auth/logout?redirectToLogin=true");
            }
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
