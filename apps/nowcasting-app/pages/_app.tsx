import "../styles/globals.css";
import localFont from "next/font/local";
import { applyDisplayLocale } from "../lib/time/display";
import { SWRConfig } from "swr";
import * as Sentry from "@sentry/nextjs";
import { AxiosError } from "axios";
import { GoogleTagManager } from "@next/third-parties/google";
import CustomUserProvider from "../components/auth/CustomUserProvider";
import ThemeToggle from "../components/dev/theme-toggle";
import { PresenceProvider } from "../components/presence/presenceProvider";
import { PresenceMetadataBridge } from "../components/presence/presenceMetadataBridge";
import { LinkedInInsightTag } from "nextjs-linkedin-insight-tag";

// Applies Luxon's global display locale on import — every date and time in the app is written
// the GB way regardless of the viewer's browser. See `lib/time/display.ts`.
applyDisplayLocale();

// OCF brand faces, self-hosted from `fonts/` and matching the main website's stack:
// MatterXH for body copy, MatterSemiMono for tabular/monospaced values, Pangram Sans
// for numerals. Declared here rather than in `_document` because `next/font` is not
// supported there — the CSS variables are put on `:root` below so portals and the
// Leaflet/Mapbox overlays inherit them too.
const matterXH = localFont({
  src: [
    { path: "../fonts/MatterXHLight.woff2", weight: "300", style: "normal" },
    { path: "../fonts/MatterXHRegular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/MatterXHMedium.woff2", weight: "500", style: "normal" }
  ],
  display: "swap"
});

const matterSemiMono = localFont({
  src: [
    { path: "../fonts/MatterSemiMonoRegular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/MatterSemiMonoMedium.woff2", weight: "500", style: "normal" }
  ],
  display: "swap"
});

const pangramSans = localFont({
  src: [
    {
      path: "../fonts/PPPangramSansRounded-CompactRegular.woff2",
      weight: "400",
      style: "normal"
    }
  ],
  display: "swap"
});

function MyApp({ Component, pageProps }: any) {
  return (
    <>
      <style jsx global>{`
        :root {
          --font-matter-xh: ${matterXH.style.fontFamily};
          --font-matter-semi-mono: ${matterSemiMono.style.fontFamily};
          --font-pangram-sans: ${pangramSans.style.fontFamily};
        }
      `}</style>
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
            {/* TEMPORARY: theme preview flip. Remove with `components/dev/theme-toggle.tsx`. */}
            {/*<ThemeToggle />*/}
            <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID || ""} />
          </PresenceProvider>
        </SWRConfig>
      </CustomUserProvider>
    </>
  );
}

export default MyApp;
