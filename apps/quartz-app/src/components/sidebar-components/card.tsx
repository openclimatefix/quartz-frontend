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
  const textClass = energyTag !== "Power" ? `text-5xl` : `text-6xl`;
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
          <div className={energyTag !== "Power" ? `w-6 h-3 relative` : ""}>
            <div
              className={
                energyTag !== "Power"
                  ? `w-6 h-1 left-0 top-[4px] absolute ${bgTheme} rounded-2xl`
                  : ""
              }
            ></div>
          </div>
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

{
  /* <label className="inline-flex items-center cursor-pointer">
  <input type="checkbox" value="" className="sr-only peer" checked disabled>
  <div className="relative w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
  <span className="ms-3 text-sm font-medium text-gray-400 dark:text-gray-500">Disabled checked</span>
</label> */
}
