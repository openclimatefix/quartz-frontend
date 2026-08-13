import "../styles/globals.css";
import { applyDisplayLocale } from "../lib/time/display";
import { SWRConfig } from "swr";
import * as Sentry from "@sentry/nextjs";
import { AxiosError } from "axios";
import { GoogleTagManager } from "@next/third-parties/google";
import CustomUserProvider from "../components/auth/CustomUserProvider";
import { PresenceProvider } from "../components/presence/presenceProvider";
import { PresenceMetadataBridge } from "../components/presence/presenceMetadataBridge";
import { LinkedInInsightTag } from "nextjs-linkedin-insight-tag";

// Applies Luxon's global display locale on import — every date and time in the app is written
// the GB way regardless of the viewer's browser. See `lib/time/display.ts`.
applyDisplayLocale();

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
        <PresenceProvider>
          <PresenceMetadataBridge />
          <LinkedInInsightTag partnerId={process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID} />
          <Component {...pageProps} />
          <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID || ""} />
        </PresenceProvider>
      </SWRConfig>
    </CustomUserProvider>
  );
}

export default MyApp;
