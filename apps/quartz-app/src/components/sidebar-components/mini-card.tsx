// This component is a small card that displays the current generation and forecast for a specific energy source
// It is used in the collapsed sidebar
import { RightArrow } from "../icons/icons";
import { useGlobalState } from "../helpers/globalState";

type MiniCardProps = {
  icon: JSX.Element;
  bgTheme: string;
  textTheme: string;
  actualGeneration?: number | string;
  currentForecast?: number | string;
  energyTag: "Wind" | "Solar" | "Power";
  nextForecast?: number | string;
  toggle?: boolean;
};

const MiniCard: React.FC<MiniCardProps> = ({
  icon,
  textTheme,
  bgTheme,
  actualGeneration,
  nextForecast,
  toggle,
  energyTag,
}) => {
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
    <div className="self-stretch h-[84px] flex-col justify-start items-start gap-8 flex">
      <div className="self-stretch h-10 flex-col justify-start items-start gap-2 flex">
        <div className="self-stretch justify-center items-center gap-2 inline-flex">
          {icon}
        </div>
        {toggle ? (
          <label className="inline-flex items-center cursor-pointer pt-1 pb-1">
            <div
              onClick={toggleLineVisibility}
              className={`relative w-8 h-1 ${bgTheme} rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute ${formatToggle} after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:mt-[-3.5px] after:transition-slow `}
            ></div>
          </label>
        ) : null}
        <div
          className={`self-stretch text-center text-base font-bold font-sans leading-none ${actualGenerationColor}`}
        >
          {actualGeneration}
        </div>
      </div>
      <div className="self-stretch h-7 flex-col justify-start items-center gap-1 flex">
        <div className="h-2 px-2 pb-1 justify-center items-center inline-flex">
          <RightArrow />
        </div>
        <div
          className={`text-center ${textTheme} text-base  pb-4 font-bold font-sans leading-none mb-2"`}
        >
          {nextForecast}
        </div>
      </div>
    </div>
  );
};

export default MiniCard;
