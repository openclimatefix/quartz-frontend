// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { ErrorEvent } from "@sentry/types";
import { EventHint } from "@sentry/nextjs";

Sentry.init({
  dsn: "https://3b5237320bf70088737fe3aae018292d@o400768.ingest.us.sentry.io/4507622592151552",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampler: ({ name, attributes, parentSampled }) => {
    // Check if the event is an error, transaction, or session
    if (name.includes("error")) {
      // Always sample errors
      return 1;
    }

    // Continue trace decision, if there is any parentSampled information
    if (typeof parentSampled === "boolean") {
      return parentSampled;
    }

    // Else, use default sample rate (replacing tracesSampleRate)
    return 0.01;
  },
  beforeSend(event: ErrorEvent, hint: EventHint) {
    // Check if it is an exception
    if (event.exception) {
      // Check if it is an ErrorEvent
      if (event.exception.values) {
        // Add a tag to all ErrorEvents
        event.tags = {
          ...event.tags,
          error_event: "true",
        };
      }
    }
    return event;
  },

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
