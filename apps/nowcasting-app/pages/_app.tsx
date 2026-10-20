import "../styles/globals.css";
import localFont from "next/font/local";
import { applyDisplayLocale } from "../lib/time/display";
import { SWRConfig } from "swr";
import * as Sentry from "@sentry/nextjs";
import { GoogleTagManager } from "@next/third-parties/google";
import CustomUserProvider from "../components/auth/CustomUserProvider";
import { PresenceProvider } from "../components/presence/presenceProvider";
import { PresenceMetadataBridge } from "../components/presence/presenceMetadataBridge";
import { LinkedInInsightTag } from "nextjs-linkedin-insight-tag";
import { createErrorReporter } from "../hooks/data/query";

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

// One Sentry event per failing key per failure episode, for v1 and v0 errors alike; 401,
// 403, 404 and network failures are not reported. See `createErrorReporter`.
const errorReporter = createErrorReporter((error) => Sentry.captureException(error));

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
            onError: (error: unknown, key: string) => {
              errorReporter.onError(error, key);
              console.log("error", key, error);
            },
            onSuccess: errorReporter.onSuccess
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
    </>
  );
}

export default MyApp;
