// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  // Disable Sentry if on local dev
  enabled:
    process.env.NEXT_PUBLIC_SENTRY_DISABLED !== "true" && process.env.NODE_ENV !== "development",
  dsn: SENTRY_DSN || "https://73795b548c864e1ea5c4d2aa699db870@o400768.ingest.sentry.io/6149810",
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: (samplingContext) => {
    // Exclude localhost traffic from being sampled in Sentry
    if (samplingContext.location?.search("localhost")) {
      return 0;
    }
    if (samplingContext.request?.headers?.host?.search("localhost")) {
      return 0;
    }
    // Sample errors at 100%
    if (samplingContext.transactionContext.name.search("error")) {
      // These are important - take a big sample
      return 1;
    }
    if (samplingContext.transactionContext.status?.search("error")) {
      return 1;
    }
    // Default sample rate
    return 0.01;
  },
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // If the entire session is not sampled, use the below sample rate to sample
  // sessions when an error occurs.
  replaysOnErrorSampleRate: 1.0,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV_LABEL || process.env.NODE_ENV
  // ...
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
});
