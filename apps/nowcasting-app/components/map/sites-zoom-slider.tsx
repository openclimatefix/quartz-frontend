import useGlobalState from "../helpers/globalState";

const SitesMapSlider: React.FC<{ selected?: string; unselected?: string; event?: any }> = ({
  selected,
  unselected
}) => {
  const [zoom] = useGlobalState("zoom");

  unselected = "bg-ocf-delta-950 px-2 opacity-40 ";
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
      <div className="absolute bg-mapbox-black-700 bottom-12 flex flex-col left-0 ml-12 z-20">
        <div className="h-5 bg-ocf-delta-950 opacity-60 text-ocf-gray-300 text-center text-sm">
          Currently Viewing
        </div>
        <div className="flex flex-row text-center text-ocf-gray-600 cursor-pointer">
          <div className={zoomLevel === "National" ? selected : unselected}>National</div>
          <div className={zoomLevel === "Regional" ? selected : unselected}>Regional</div>
          <div className={zoomLevel === "GSP" ? selected : unselected}>GSP</div>
          <div className={zoomLevel === "Sites" ? selected : unselected}>Sites</div>
        </div>
      </div>
    </>
  );
};
export default SitesMapSlider;
