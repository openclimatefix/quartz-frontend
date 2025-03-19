# Quartz Solar UI

This is the main Quartz Solar UI, hosted at [app.quartz.solar](app.quartz.solar).
It is used by customers to log in and view their forecasts.

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

The environment variables in `.env.example` need to be populated to make sure Auth0 is working properly.
Place them in a `.env.local` file in the root of this app folder (`nowcasting-app`).


### Running the API locally

The app needs to communicate with the API to fetch the forecasts, even if they are fake data in the local environment.
To run the API locally, follow the instructions in the 
[nowcasting-api README](https://github.com/openclimatefix/uk-pv-national-gsp-api) to set up and run the API.

### Running the App

Now we are ready to run the app. Navigate back into the app folder and start the development server using yarn.

```bash
cd apps/nowcasting-app
yarn dev
```

Open [http://localhost:3002](http://localhost:3002) with your browser to see the result.

## Deployment

The app gets automatically deployed to Vercel, on each merge to the `development`, `staging`, and `main` branches.
Any Pull Requests are deployed on their own respective Preview branches when granted an OCF Team member.

## Storybook

This part of the app is slightly unloved, but it is still possible to run Storybook to see the components in isolation.

```bash
yarn run storybook
```

## How to run the tests

```bash
yarn test
```
