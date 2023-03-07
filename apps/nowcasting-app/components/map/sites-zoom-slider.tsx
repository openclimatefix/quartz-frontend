import useGlobalState from "../helpers/globalState";

const SitesMapSlider: React.FC<{ highlightColor?: string; bgColor?: string }> = ({
  hightlightColor,
  bgColor
}) => {
  const [zoom] = useGlobalState("zoom");
  bgColor = "bg-ocf-delta-950";
  hightlightColor = "bg-ocf-yellow-500 font-bold border-1 border-black";
  console.log(zoom);
  let zoomLevel;
  if (zoom <= 6) {
    zoomLevel = "National";
  } else if (zoom > 6 && zoom <= 7) {
    zoomLevel = "Regional";
  } else if (zoom > 7 && zoom <= 8.5) {
    console.log("GSP level zoom");
    zoomLevel = "GSPs";
  } else {
    console.log("Site level zoom");
    zoomLevel = "Sites";
  }
  return (
    <>
      <div className="flex flex-col w-24 text-center text-black">
        <div className={zoomLevel === "National" ? hightlightColor : bgColor}>National</div>
        <div className={zoomLevel === "Regional" ? hightlightColor : bgColor}>Regional</div>
        <div className={zoomLevel === "GSPs" ? hightlightColor : bgColor}>GSP</div>
        <div className={zoomLevel === "Sites" ? hightlightColor : bgColor}>Sites</div>
      </div>
    </>
  );
};
export default SitesMapSlider;
