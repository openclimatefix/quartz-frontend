import useGlobalState from "../helpers/globalState";

const SitesMapSlider: React.FC<{ selected?: string; unselected?: string; event?: any }> = ({
  selected,
  unselected
}) => {
  const [zoom] = useGlobalState("zoom");

  unselected = "bg-ocf-delta-950 px-2 opacity-60 ";
  selected =
    "bg-ocf-yellow-500 px-3 text-black transition ease-in-out delay-400 font-bold border-1 border-black";
  console.log(zoom);
  let zoomLevel;
  if (zoom <= 5) {
    zoomLevel = "National";
  } else if (zoom > 5 && zoom < 7) {
    zoomLevel = "Regional";
  } else if (zoom >= 7 && zoom <= 8.5) {
    zoomLevel = "GSP";
  } else {
    zoomLevel = "Sites";
  }
  return (
    <>
      <div className="absolute top-0 m-4 bg-transparent flex flex-col right-2 ml-12 z-20">
        <div className="pb-1 text-white text-center text-base">Current Aggregation Level</div>
        <div className="flex flex-row text-center text-ocf-gray-600 cursor-pointer">
          <div className={zoomLevel === "National" ? selected : unselected}>National</div>
          <div className={zoomLevel === "Regional" ? selected : unselected}>Region</div>
          <div className={zoomLevel === "GSP" ? selected : unselected}>Grid Supply Point</div>
          <div className={zoomLevel === "Sites" ? selected : unselected}>Site</div>
        </div>
      </div>
    </>
  );
};
export default SitesMapSlider;
