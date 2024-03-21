import { useGlobalState } from "../helpers/globalState";

interface CardProps {
  energyTag: "Wind" | "Solar" | "Power";
  icon: JSX.Element;
  actualGeneration?: number | string | JSX.Element;
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
  const [visibleLines, setVisibleLines] = useGlobalState("visibleLines");
  const isVisible = visibleLines.includes(energyTag);
  const formatToggle = visibleLines.includes(energyTag)
    ? `after:end-[-2px]`
    : `after:start-[-2px]`;
  const formatBackground = !visibleLines.includes(energyTag)
    ? (bgTheme = `bg-ocf-grey-400`)
    : bgTheme == bgTheme;

  const toggleLineVisibility = () => {
    if (isVisible) {
      const newVisibleLines = visibleLines.filter(
        (line: string) => line !== energyTag
      );
      if (newVisibleLines.length === 0) {
        setVisibleLines(energyTag === "Solar" ? ["Wind"] : ["Solar"]);
      } else {
        setVisibleLines(newVisibleLines);
      }
    } else {
      setVisibleLines([...visibleLines, energyTag]);
    }
  };

  let actualGenerationColor = "text-white";
  if (energyTag === "Wind") {
    actualGenerationColor = `text-quartz-blue-100`;
  }
  if (energyTag === "Solar") {
    actualGenerationColor = `text-quartz-yellow-100`;
  }

  return (
    // add clock component here and pass the time as props
    <div className="self-stretch flex-col justify-start items-start flex">
      <div className="self-stretch justify-between items-end inline-flex mb-2">
        <div
          className={`${textClass} font-bold font-sans leading-10 ${actualGenerationColor}`}
        >
          {actualGeneration}
        </div>
        <div className="justify-start items-center gap-2 flex">
          <div className="w-8 h-8 relative">{icon}</div>
          <div className="w-[60px] text-white text-base font-medium font-sans uppercase">
            {energyTag}
          </div>
          {toggle ? (
            <label className="inline-flex items-center cursor-pointer ">
              <div
                onClick={toggleLineVisibility}
                className={`relative w-8 h-2 ${bgTheme} rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute ${formatToggle} after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:mt-[-3.5px] after:transition-slow `}
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
