// This component is a small card that displays the current generation and forecast for a specific energy source
// It is used in the collapsed sidebar
import { RightArrow } from "../icons/icons";

type MiniCardProps = {
  icon: JSX.Element;
  bgTheme: string;
  textTheme: string;
  actualGeneration: number;
  currentForecast?: number;
  nextForecast?: number;
  toggle?: boolean;
};

const MiniCard: React.FC<MiniCardProps> = ({
  icon,
  textTheme,
  bgTheme,
  actualGeneration,
  nextForecast,
}) => {
  return (
    <div className="self-stretch h-[84px] flex-col justify-start items-start gap-8 flex">
      <div className="self-stretch h-10 flex-col justify-start items-start gap-2 flex">
        <div className="self-stretch justify-center items-center gap-2 inline-flex">
          {icon}
        </div>
        <div className="self-stretch text-center text-white text-base font-bold font-sans leading-none">
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
