import ButtonGroup from "./button-group";
import { getTimeFromDate } from "./utils";

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
  const options = [0, 1, 2].map((i) => ({
    label: getTimeFromDate(new Date(targetTimes[i].targetTime)),
    active: selectedTimeHorizon === i,
    onClick: () => setSelectedTimeHorizon(i),
  }));

  return <ButtonGroup options={options} />;
};

export default TimeHorizonSelector;
