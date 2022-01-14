# Nowcasting App

This is the main Nowcasting App, hosted at [app.nowcasting.io](app.nowcasting.io).
It is used by customers to login and view their forecasts.

## Getting Started

First, run the development server:

```bash
yarn install
yarn dev
```

## Environment Variables

The following environment variables need to be populated:

```bash
# A long, secret value used to encrypt the session cookie
AUTH0_SECRET='<secret>'
# The base url of your application
AUTH0_BASE_URL='http://localhost:3002'
# The url of your Auth0 tenant domain
AUTH0_ISSUER_BASE_URL='https://<tenent domain>.auth0.com'
# Your Auth0 application's Client ID
AUTH0_CLIENT_ID='<client id>'
# Your Auth0 application's Client Secret
AUTH0_CLIENT_SECRET='<client secret>'

```

Open [http://localhost:3002](http://localhost:3002) with your browser to see the result.
