import ButtonGroup from "./button-group";

interface IGSPOrNationalSelector {
  showGSPForecast: boolean;
  setShowGSPForecast: React.Dispatch<React.SetStateAction<boolean>>;
}

const GSPOrNationalSelector = ({
  showGSPForecast,
  setShowGSPForecast,
}: IGSPOrNationalSelector) => {
  return (
    <ButtonGroup
      options={[
        {
          label: "GSP",
          active: showGSPForecast,
          onClick: () => setShowGSPForecast(true),
        },
        {
          label: "National",
          active: !showGSPForecast,
          onClick: () => setShowGSPForecast(false),
        },
      ]}
    />
  );
};

export default GSPOrNationalSelector;
