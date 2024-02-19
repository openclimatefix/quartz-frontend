import ForecastTimeDisplay from "./forecast-time";

interface CardProps {
  energyTag: string;
  icon: JSX.Element;
  actualGeneration: number;
  currentForecast?: number;
  nextForecast?: number;
  bgTheme: string;
  textTheme: string;
  largeText?: string;
  smallText?: string;
}

const WideCard: React.FC<CardProps> = ({
  icon,
  actualGeneration,
  currentForecast,
  nextForecast,
  energyTag,
  bgTheme,
  textTheme,
}) => {
  return (
    // add clock component here and pass the time as props
    <div className="self-stretch h-[136px] flex-col justify-start items-start gap-2 flex">
      <div className="self-stretch justify-between items-start inline-flex">
        <div className="text-white text-5xl font-bold font-sans leading-[64px]">
          {actualGeneration}
        </div>
        <div className="justify-start items-center gap-2 flex">
          <div className="w-8 h-8 relative">{icon}</div>
          <div className="w-[60px] text-white text-base font-medium font-sans uppercase">
            {energyTag}
          </div>
          <div className="w-6 h-3 relative">
            <div
              className={`w-6 h-1 left-0 top-[4px] absolute ${bgTheme} rounded-2xl`}
            ></div>
          </div>
        </div>
      </div>
      <div className="self-stretch justify-between items-start inline-flex">
        <div
          className={`w-[105px] ${textTheme} text-5xl font-bold font-sans leading-[64px]`}
        >
          {currentForecast}
        </div>
        <div
          className={`${textTheme} text-5xl font-bold font-sans leading-[64px]`}
        >
          {nextForecast}
        </div>
      </div>
    </div>
  );
};

export default WideCard;
