# Quartz Solar UI

This is the main Quartz Solar UI, hosted at [app.quartz.solar](app.quartz.solar).
It is used by customers to login and view their forecasts.

## Getting Started

### Installing

This repository is using Turborepo as the build system.
First, you need to install the dependencies.
We use yarn as our package manager.

```bash
cd ../../ # so you are at the root of the repository
yarn install
```

### Setting Environment Variables

The following environment variables need to be populated to make sure Auth0 is working properly.
Place them in the file `.env.local` in the root of this app folder.

```bash
# ./apps/nowcasting-app/.env.local

# A long, secret value used to encrypt the session cookie
AUTH0_SECRET='<secret>'
# The base url of your application
AUTH0_BASE_URL='http://localhost:3002'
# The url of your Auth0 tenant domain
AUTH0_ISSUER_BASE_URL='https://nowcasting-dev.eu.auth0.com'
# Your Auth0 application's Client ID
AUTH0_CLIENT_ID='<client id>'
# Your Auth0 application's Client Secret
AUTH0_CLIENT_SECRET='<client secret>'
# Disable Sentry on local to avoid noise 
# (should default to off in development env anyway but just to make sure)
NEXT_PUBLIC_SENTRY_DISABLED='true'
```

### Running the App

Now we are ready to run the app. Navigate back into the app folder and start the development server using yarn.

```bash
cd apps/nowcasting-app
yarn dev
```

Open [http://localhost:3002](http://localhost:3002) with your browser to see the result.

## Deployment

The app gets automatically deployed to Vercel, on each push to the `main` branch.

## Storybook

```bash
yarn run storybook
```

## How to run the tests

```bash
yarn test
```
