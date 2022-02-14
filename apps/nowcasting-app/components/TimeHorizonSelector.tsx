import { classNames, getTimeFromDate } from "./utils";

interface ITimeHorizonSelector {
  selectedTimeHorizon: number;
  setSelectedTimeHorizon: React.Dispatch<React.SetStateAction<number>>;
  targetTimes: [
    {
      targetTime: string;
      expectedPowerGenerationMegawatts: number;
    },
    {
      targetTime: string;
      expectedPowerGenerationMegawatts: number;
    },
    {
      targetTime: string;
      expectedPowerGenerationMegawatts: number;
    }
  ];
}

const TimeHorizonSelector = ({
  selectedTimeHorizon,
  setSelectedTimeHorizon,
  targetTimes,
}: ITimeHorizonSelector) => {
  const ACTIVE_BUTTON_STYLES =
    "bg-indigo-500 focus:ring-black focus:border-black text-white";
  const INACTIVE_BUTTON_STYLES =
    "bg-white hover:bg-gray-50 focus:ring-indigo-500 focus:border-indigo-500";
  const BASE_BUTTON_STYLES =
    "relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 focus:z-10 focus:outline-none focus:ring-1";

  return (
    <div className="flex justify-center w-full">
      <span className="relative z-0 inline-flex rounded-md shadow-sm">
        <button
          className={classNames(
            selectedTimeHorizon === 0
              ? ACTIVE_BUTTON_STYLES
              : INACTIVE_BUTTON_STYLES,
            BASE_BUTTON_STYLES,
            "rounded-l-md"
          )}
          onClick={() => setSelectedTimeHorizon(0)}
        >
          {getTimeFromDate(new Date(targetTimes[0].targetTime))}
        </button>
        <button
          className={classNames(
            selectedTimeHorizon === 1
              ? ACTIVE_BUTTON_STYLES
              : INACTIVE_BUTTON_STYLES,
            BASE_BUTTON_STYLES,
            "-ml-px"
          )}
          onClick={() => setSelectedTimeHorizon(1)}
        >
          {getTimeFromDate(new Date(targetTimes[1].targetTime))}
        </button>
        <button
          className={classNames(
            selectedTimeHorizon === 2
              ? ACTIVE_BUTTON_STYLES
              : INACTIVE_BUTTON_STYLES,
            BASE_BUTTON_STYLES,
            "-ml-px rounded-r-md"
          )}
          onClick={() => setSelectedTimeHorizon(2)}
        >
          {getTimeFromDate(new Date(targetTimes[2].targetTime))}
        </button>
      </span>
    </div>
  );
};

export default TimeHorizonSelector;
