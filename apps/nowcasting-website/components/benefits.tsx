interface IBenefits {}

const benefits = [
  {
    name: "Continually updating forecasts in real-time",
    description:
      "You receive the most up to date information minutes after a satellite image, weather forecasts or PV readings are received.",
    icon: "refresh",
  },
  {
    name: "High accuracy from cutting edge ML",
    description:
      "You have the best information to optimise your decisions to operationally and financially manage the electricity grid.",
    icon: "accuracy",
  },
  {
    name: "High temporal and spatial resolution",
    description:
      "As decisions move closer to real-time in a highly decentralised grid, it is ever more important to have highly granular data - hourly is not enough.",
    icon: "time-left",
  },
  {
    name: "Expected and tail forecasts",
    description:
      "You understand the upside and downside scenarios of the forecast and can make decisions to manage those risks.",
    icon: "caution-sign",
  },
  {
    name: "Growth potential",
    description:
      "The techniques we are using are powerful enough to grow, meaning your forecasts will improve every year, and further, we have ambitions to work with wind and demand forecasting in the future.",
    icon: "arrows",
  },
];

const Benefits = ({}: IBenefits) => {
  return (
    <div className="mx-auto max-w-[98ch] mt-8">
      <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
        {benefits.map((feature) => (
          <div key={feature.name} className="relative">
            <dt>
              <div className="absolute flex items-center justify-center w-12 h-12 text-black rounded-md bg-ocf-teal-500">
                <img
                  src={`/icons/${feature.icon}.svg`}
                  className="w-8 h-8"
                  aria-hidden="true"
                />
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
  );
};

export default Benefits;
