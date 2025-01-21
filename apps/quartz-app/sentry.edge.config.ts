// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { EventHint, ErrorEvent } from "@sentry/nextjs";

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
});
