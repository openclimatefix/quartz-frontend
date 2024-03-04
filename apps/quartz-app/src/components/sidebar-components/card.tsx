import { useGlobalState } from "../helpers/globalState";

interface CardProps {
  energyTag: string;
  icon: JSX.Element;
  actualGeneration?: number | string;
  currentForecast?: number | string;
  nextForecast?: number | string;
  bgTheme: string;
  textTheme: string;
  largeText?: string;
  smallText?: string;
  toggle?: boolean;
  dataKey?: string;
}

const WideCard: React.FC<CardProps> = ({
  icon,
  actualGeneration,
  currentForecast,
  nextForecast,
  energyTag,
  bgTheme,
  toggle,
  textTheme,
}) => {
  const textClass = energyTag !== "Power" ? `text-5xl` : `text-6xl`;
  const energyTagNotPower = energyTag !== "Power";
  const [visibleLines, setVisibleLines] = useGlobalState("visibleLines");
  const isVisible = visibleLines.includes(energyTag);

  const toggleLineVisibility = () => {
    if (isVisible) {
      setVisibleLines(
        visibleLines.filter((line: string) => line !== energyTag)
      );
    } else {
      setVisibleLines([...visibleLines, energyTag]);
    }
  };

  return (
    // add clock component here and pass the time as props
    <div className="self-stretch h-[136px] flex-col justify-start items-start gap-2 flex">
      <div className="self-stretch justify-between items-start inline-flex">
        <div
          className={`text-white ${textClass} font-bold font-sans leading-[64px]`}
        >
          {actualGeneration}
        </div>
        <div className="justify-start items-center gap-2 flex">
          <div className="w-8 h-8 relative">{icon}</div>
          <div className="w-[60px] text-white text-base font-medium font-sans uppercase">
            {energyTag}
          </div>
          {toggle ? (
            <label className="inline-flex items-center mb-5 cursor-pointer">
              <div
                onClick={toggleLineVisibility}
                className={`relative w-12 h-3 ${bgTheme} rounded-full peer dark:${bgTheme}peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600`}
              ></div>
            </label>
          ) : null}
        </div>
      </div>
      <div className="self-stretch justify-between items-start inline-flex">
        <div
          className={`w-[105px] ${textTheme} ${textClass} font-bold font-sans leading-[64px]`}
        >
          {currentForecast}
        </div>
        <div
          className={`${textTheme} ${textClass} font-bold font-sans leading-[64px]`}
        >
          {nextForecast}
        </div>
      </div>
    </div>
  );
};

export default WideCard;
