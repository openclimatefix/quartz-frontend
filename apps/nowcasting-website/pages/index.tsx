import type { NextPage } from "next";
import { SVGProps } from "react";
import Head from "next/head";
import {
  AnnotationIcon,
  GlobeAltIcon,
  LightningBoltIcon,
  ScaleIcon,
} from "@heroicons/react/outline";

import NavBar from "../components/nav-bar";
import EmailSignup from "../components/email-signup";
import Users from "../components/users";

const Home: NextPage = () => {
  const footerNavigation = [
    {
      name: "Twitter",
      href: "https://twitter.com/openclimatefix",
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
          <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
        </svg>
      ),
    },
    {
      name: "GitHub",
      href: "https://github.com/openclimatefix",
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
          <path
            fillRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  ];

  const benefits = [
    {
      name: "Continually updating forecasts in real-time",
      description:
        "You receive the most up to date information minutes after a satellite image, weather forecasts or PV readings are received.",
      icon: GlobeAltIcon,
    },
    {
      name: "High accuracy from cutting edge ML",
      description:
        "You have the best information to optimise your decisions to operationally and financially manage the electricity grid.",
      icon: ScaleIcon,
    },
    {
      name: "High temporal and spatial resolution",
      description:
        "As decisions move closer to real-time in a highly decentralised grid, it is ever more important to have highly granular data - hourly is not enough.",
      icon: LightningBoltIcon,
    },
    {
      name: "Expected and tail forecasts",
      description:
        "You understand the upside and downside scenarios of the forecast and can make decisions to manage those risks.",
      icon: AnnotationIcon,
    },
    {
      name: "Growth potential",
      description:
        "The techniques we are using are powerful enough to grow, meaning your forecasts will improve every year, and further, we have ambitions to work with wind and demand forecasting in the future.",
      icon: AnnotationIcon,
    },
  ];

  return (
    <>
      <Head>
        <title>
          NOWCASTING - The intuition of a meteorologist with the speed of a
          machine
        </title>
        <meta
          name="description"
          content={
            "The intuition of a meteorologist with the speed of a machine. Forecasting solar energy generation from minutes to hours ahead."
          }
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </Head>

      <NavBar />

      <div className="pb-8 bg-white sm:pb-12 lg:pb-12">
        <div className="pt-8 overflow-hidden sm:pt-12 lg:relative lg:py-48">
          <div className="max-w-md px-4 mx-auto sm:max-w-3xl sm:px-6 lg:px-8 lg:max-w-7xl lg:grid lg:grid-cols-2 lg:gap-24">
            <div>
              <div className="mt-20">
                <div className="mt-6 sm:max-w-xl">
                  <h1 className="">
                    <span className="block ml-1 text-sm font-semibold tracking-wide text-gray-500 uppercase sm:text-base lg:text-sm xl:text-base">
                      Coming soon
                    </span>
                    <span className="block mt-1 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
                      Solar NOWCASTING
                    </span>
                  </h1>
                  <p className="mt-6 text-xl text-gray-500">
                    The intuition of a meteorologist with the speed of a
                    machine.
                  </p>
                  <p className="mt-2 text-xl text-gray-500">
                    Forecasting solar energy generation from minutes to hours
                    ahead.
                  </p>

                  <div className="mt-6 mb-4 prose">
                    {/* NOWCASTING from{" "}
                    <a href="https://openclimatefix.org">Open Climate Fix</a>{" "}
                    is:
                    <ul>
                      <li>Using cutting edge machine learning</li>
                      <li>Continually rolling</li>
                      <li>Highly accurate</li>
                      <li>Open source</li>
                      <li>Probabilistic</li>
                    </ul> */}
                    NOWCASTING solution is for:
                  </div>
                  <Users />
                </div>
                <div className="mt-12">
                  <EmailSignup />
                </div>
              </div>
            </div>
          </div>

          <div className="sm:mx-auto sm:max-w-3xl sm:px-6">
            <div className="py-12 sm:relative sm:mt-12 sm:py-16 lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
              <div className="hidden sm:block">
                <div className="absolute inset-y-0 w-screen left-1/2 bg-gray-50 rounded-l-3xl lg:left-80 lg:right-0 lg:w-full" />
                <svg
                  className="absolute -mr-3 top-8 right-1/2 lg:m-0 lg:left-0"
                  width={404}
                  height={392}
                  fill="none"
                  viewBox="0 0 404 392"
                >
                  <defs>
                    <pattern
                      id="837c3e70-6c3a-44e6-8854-cc48c737b659"
                      x={0}
                      y={0}
                      width={20}
                      height={20}
                      patternUnits="userSpaceOnUse"
                    >
                      <rect
                        x={0}
                        y={0}
                        width={4}
                        height={4}
                        className="text-gray-200"
                        fill="currentColor"
                      />
                    </pattern>
                  </defs>
                  <rect
                    width={404}
                    height={392}
                    fill="url(#837c3e70-6c3a-44e6-8854-cc48c737b659)"
                  />
                </svg>
              </div>
              <div className="relative pl-4 -mr-40 sm:mx-auto sm:max-w-3xl sm:px-0 lg:max-w-none lg:h-full lg:pl-12">
                <img
                  className="w-full rounded-md shadow-xl ring-1 ring-black ring-opacity-5 lg:h-full lg:w-auto lg:max-w-none"
                  src="/panels.png"
                  alt=""
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-6 bg-ocf-yellow-500" />

      <section
        id="challenge"
        className="relative py-16 pt-24 overflow-hidden bg-white"
      >
        <div className="relative px-4 sm:px-6 lg:px-8">
          <div className="mx-auto text-lg max-w-prose">
            <h2 className="block mt-2 text-3xl font-extrabold leading-8 tracking-tight text-center text-gray-900 sm:text-4xl">
              Challenge
            </h2>
            {/* <p className="mt-8 text-xl leading-8 text-gray-500">
              Solar generation is forecast to be the largest source of
              electricity generation globally by 2040.
            </p> */}
          </div>
          <div className="mx-auto mt-6 prose prose-lg text-justify text-gray-500 prose-indigo">
            <blockquote>
              Solar generation is forecast to be the largest source of
              electricity generation globally by 2040.
            </blockquote>
            <p>
              The rise of solar is creating challenges for electricity grid
              operators and market participants alike. The energy generated by
              solar panels changes rapidly as clouds move overhead and weather
              forecasts struggle to predict clouds accurately.
            </p>
            <p>
              As solar penetration increases, the uncertainty in solar
              electricity forecasts is causing headaches not just for those with
              solar assets but for anyone building a business or optimising
              their electricity use.
            </p>
            <p>
              Current forecast approaches use Numerical Weather Predictions,
              which take several hours to compute. This leaves a “blind spot” in
              forecasting short time horizons from a few minutes to hours ahead.
              Experienced practitioners and meteorologists can fill this gap by
              using satellite imagery and “human intelligence” to informally
              improve the solar forecast. But this is not scalable as
              meteorologists are not available to most teams and with machine
              learning, it should be possible to automate these intuitions.
            </p>
            <p>It needn&apos;t be like this.</p>
          </div>
        </div>
      </section>

      <div className="w-full h-6 bg-ocf-yellow-500" />

      <section id="solution" className="py-12 pt-24 bg-white">
        <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="block mt-2 text-3xl font-extrabold leading-8 tracking-tight text-center text-gray-900 sm:text-4xl">
              Solution
            </h2>
            {/* <p className="max-w-2xl mt-4 text-xl text-gray-500 lg:mx-auto">
                Lorem ipsum dolor sit amet consect adipisicing elit. Possimus
                magnam voluptatum cupiditate veritatis in accusamus quisquam.
              </p> */}
          </div>

          <div className="mx-auto mt-24 prose prose-lg text-gray-500">
            <h3>NOWCASTING delivers</h3>
            <ul role="list">
              <li>
                Forecasts for individual solar assets, regions or an entire
                market.
              </li>
              <li>
                Forecast horizons from now out to days ahead in five-minute
                intervals.
              </li>
              <li>
                Expected and tail event forecasts - highlighting worst-case
                outcomes.
              </li>
              <li>
                Geographical coverage is the UK initially and expanding to other
                European and global locations from 2023.
              </li>
            </ul>
          </div>
          <div className="mx-auto mt-24 prose prose-lg text-justify text-gray-500">
            <h3>Ready to use</h3>
            <p>
              Open Climate Fix manages this torrent of data with a robust data
              pipeline to enable our customers to rely on the best forecasts,
              without the need to download and wrestle with Gigabytes of
              satellite and weather data. The machine learning prediction is
              fast to run, delivering actionable information in minutes after a
              new satellite image is recorded, and forecasts are available
              through a user interface or automatically through an API.
            </p>
            <figure>
              <img
                className="w-full rounded-lg"
                src="/nowcasting-app.png"
                alt=""
                width={1310}
                height={873}
              />
              <figcaption className="text-center">
                Screenshot of the NOWCASTING application.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <div className="w-full h-6 bg-ocf-yellow-500" />

      <section id="benefits" className="py-12 pt-24 bg-white">
        <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="block mt-2 text-3xl font-extrabold leading-8 tracking-tight text-center text-gray-900 sm:text-4xl">
              Benefits
            </h2>
            {/* <p className="max-w-2xl mt-4 text-xl text-gray-500 lg:mx-auto">
                Lorem ipsum dolor sit amet consect adipisicing elit. Possimus
                magnam voluptatum cupiditate veritatis in accusamus quisquam.
              </p> */}
          </div>
          <div className="mx-auto max-w-[98ch] mt-8">
            <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              {benefits.map((feature) => (
                <div key={feature.name} className="relative">
                  <dt>
                    <div className="absolute flex items-center justify-center w-12 h-12 text-black rounded-md bg-ocf-yellow-500">
                      <feature.icon className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <p className="ml-16 text-lg font-medium leading-6 text-gray-900">
                      {feature.name}
                    </p>
                  </dt>
                  <dd className="mt-2 ml-16 text-base text-gray-500">
                    {feature.description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <div className="w-full h-6 bg-ocf-yellow-500" />

      <section
        id="technical"
        className="relative py-16 pt-24 overflow-hidden bg-white"
      >
        <div className="relative px-4 sm:px-6 lg:px-8">
          <div className="mx-auto text-lg max-w-prose">
            <h2 className="block mt-2 text-3xl font-extrabold leading-8 tracking-tight text-center text-gray-900 sm:text-4xl">
              Technical
            </h2>
          </div>
          <div className="mx-auto mt-6 prose prose-lg text-justify text-gray-500 prose-indigo">
            <p>
              Open Climate Fix observed that the gap in short term forecasting
              of clouds is filled at present through meteorologists - their
              experience applied to satellite imagery - and real-time ground
              sensors. What if we applied the latest in machine learning to all
              the data sources available simultaneously, and developed a machine
              intelligence to replicate or even surpass what is available today?
            </p>
            <p>
              NOWCASTING takes in all the data - satellite imagery, Numerical
              Weather Predictions, topographic and solar generation data - and
              applies cutting edge deep learning techniques not before seen in
              energy forecasting. These multimodal machine learning techniques
              accept data natively from different input source types without
              interpolation and have been only recently possible with advances
              in computer hardware and techniques developed in the Natural
              Language Processing field. Open Climate Fix has implemented these
              techniques and applied them to solar energy, drawing on a breadth
              of industry experience from Google Deepmind, NASA, wind
              forecasting and the transmission system operator.
            </p>
            <figure>
              <img
                className="w-full rounded-lg"
                src="/diagram.png"
                alt=""
                width={1310}
                height={873}
              />
              <figcaption className="text-center">
                Datamodel of the NOWCASTING application.
              </figcaption>
            </figure>
            <p>
              Through exhaustive experimentation and optimising of
              architectures, Open Climate Fix has developed a best in class
              forecasting framework for both deterministic and probabilistic
              forecasts.
            </p>
          </div>
        </div>
      </section>

      <div className="w-full h-6 bg-ocf-yellow-500" />

      <section
        id="open-source"
        className="relative py-16 pt-24 overflow-hidden bg-white"
      >
        <div className="relative px-4 sm:px-6 lg:px-8">
          <div className="mx-auto text-lg max-w-prose">
            <h2 className="block mt-2 text-3xl font-extrabold leading-8 tracking-tight text-center text-gray-900 sm:text-4xl">
              Open Source
            </h2>
          </div>
          <div className="mx-auto mt-6 prose prose-lg text-justify text-gray-500 prose-indigo">
            <p>
              Open Climate Fix is building our model completely out in the open!
              We are actively building collaborations, working with contributors
              and not restricting the IP behind the model.
            </p>
            <p>
              Why? It is becoming clear that open source software projects grow
              faster, are more robust and are more responsive to their
              users&apos; needs. Linux, Apache, and Python are leaders in their
              fields. By having an open model which researchers or our clients
              can build on and improve, we will develop a forecast which is
              continually improving with the state-of-the-art.
            </p>
            <p>
              So why buy an open service? Because NOWCASTING is much more than
              the model. Open Climate Fix manages and procures the huge data
              volumes involved; we keep the service available; we integrate the
              latest update from the open-source model to give the best
              forecast. Lastly, we can provide expert advice and tailor your use
              of the product.
            </p>
            <p>
              At Open Climate Fix our mission is to make managing PV power as
              easy as possible. Going open source is going to help us achieve
              that goal.
            </p>
          </div>
        </div>
      </section>

      <section
        id="email-signup"
        className="relative px-4 py-16 mx-auto overflow-hidden bg-white max-w-prose"
      >
        <EmailSignup />
      </section>

      <footer className="bg-white">
        <div className="px-4 py-12 mx-auto max-w-7xl sm:px-6 md:flex md:items-center md:justify-between lg:px-8">
          <div className="flex justify-center space-x-6 md:order-2">
            {footerNavigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">{item.name}</span>
                <item.icon className="w-6 h-6" aria-hidden="true" />
              </a>
            ))}
          </div>
          <div className="mt-8 md:mt-0 md:order-1">
            <p className="text-base text-center text-gray-400">
              &copy; 2021{" "}
              <a className="py-2" href="https://openclimatefix.org/">
                Open Climate Fix
              </a>{" "}
              Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Home;
