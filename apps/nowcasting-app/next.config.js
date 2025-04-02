// This file sets a custom webpack configuration to use your Next.js app
// with Sentry.
// https://nextjs.org/docs/api-reference/next.config.js/introduction
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

const { withSentryConfig } = require("@sentry/nextjs");

const moduleExports = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src * https://api-dev.nowcasting.io https://unpkg.com https://fonts.googleapis.com https://fonts.gstatic.com; connect-src *; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com http://localhost:* blob: https://api-dev.nowcasting.io https://www.googletagmanager.com/gtm.js; style-src 'self' https://unpkg.com/leaflet@1.7.1/dist/leaflet.css 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com;"
          }
        ]
      }
    ];
  }
};

const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry Webpack plugin. Keep in mind that
  // the following options are set automatically, and overriding them is not
  // recommended:
  //   release, url, org, project, authToken, configFile, stripPrefix,
  //   urlPrefix, include, ignore

  org: "openclimatefix",
  project: "quartz-solar-app",
  enabled: process.env.NEXT_PUBLIC_DEV_MODE !== "true",

  silent: true // Suppresses all logs
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options.
};

// Make sure adding Sentry options is the last code to run before exporting, to
// ensure that your source maps include changes from all other Webpack plugins
module.exports = withSentryConfig(moduleExports, sentryWebpackPluginOptions);
