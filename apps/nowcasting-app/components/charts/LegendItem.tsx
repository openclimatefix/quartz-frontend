import { FC, useEffect, useMemo, useState } from "react";
import useGlobalState from "../helpers/globalState";
import { LegendLineGraphIcon } from "../icons/icons";
import Toggle from "../Toggle";

const LegendItem: FC<{
  iconClasses: string;
  label: string;
  dashStyle?: "both" | "dashed" | "solid";
  dataKey: string;
}> = ({ iconClasses, label, dashStyle, dataKey }) => {
  const [visibleLines, setVisibleLines] = useGlobalState("visibleLines");
  const [mounted, setMounted] = useState(false);

  // Check if first mount has happened to force the text styling to update
  useEffect(() => setMounted(true), []);

  const isVisible = useMemo(() => visibleLines.includes(dataKey), [visibleLines, dataKey]);

  const labelClasses = `block sometimes-bold w-auto uppercase pl-1${
    mounted && isVisible ? " font-extrabold dash:font-semibold" : " text-ocf-gray-700"
  }`;

  const toggleLineVisibility = () => {
    if (isVisible) {
      setVisibleLines(visibleLines.filter((line) => line !== dataKey));
    } else {
      setVisibleLines([...visibleLines, dataKey]);
    }
  };

  return (
    <div className="flex items-center flex-initial">
      <LegendLineGraphIcon className={iconClasses} dashStyle={dashStyle} />
      <button
        className="inline-flex flex-1 text-left pl-1 max-w-full w-auto leading-tight text-2xs @lg:pr-1 @xl:pr-0 @xl:text-2xs dash:text-base dash:tracking-wider dash:pb-1"
        onClick={toggleLineVisibility}
      >
        <span className={labelClasses}>{label}</span>
      </button>
      <Toggle onClick={toggleLineVisibility} visible={mounted && isVisible} />
    </div>
  );
};

export default LegendItem;
