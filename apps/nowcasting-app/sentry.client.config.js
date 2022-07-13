// This file configures the initialization of Sentry on the browser.
// The config you add here will be used whenever a page is visited.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const disableSentry = process.env.NEXT_PUBLIC_ENV_NAME === "test";
const SENTRY_DSN =
  process.env.SENTRY_DSN ||
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  "https://73795b548c864e1ea5c4d2aa699db870@o400768.ingest.sentry.io/6149810";

Sentry.init({
  dsn: disableSentry ? null : SENTRY_DSN,
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,
  // ...
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
});
