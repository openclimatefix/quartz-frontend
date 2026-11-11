import { FC, ReactNode, useEffect, useMemo, useState } from "react";
import useGlobalState from "../helpers/globalState";
import { LegendAreaGraphIcon, LegendLineGraphIcon } from "../icons/icons";
import Toggle from "../Toggle";

const LegendItem: FC<{
  iconClasses: string;
  label: string;
  symbolStyle?: "both" | "dashed" | "solid" | "area";
  dataKey: string;
  /**
   * A control that *is* this row's name — the N-hour row, whose label states the horizon and
   * so may as well set it. It replaces the label button, which would otherwise swallow the
   * clicks meant for it; the toggle to the right still shows and switches the line.
   */
  labelControl?: ReactNode;
  /**
   * Keep the normal size in dashboard mode. The display panel is a control, sized like the map
   * settings panel beside it; only a legend read across the room should grow.
   */
  fixedSize?: boolean;
}> = ({ iconClasses, label, symbolStyle, dataKey, labelControl, fixedSize = false }) => {
  const [visibleLines, setVisibleLines] = useGlobalState("visibleLines");
  const [mounted, setMounted] = useState(false);

  // Check if first mount has happened to force the text styling to update
  useEffect(() => setMounted(true), []);

  const isVisible = useMemo(() => visibleLines.includes(dataKey), [visibleLines, dataKey]);

  const labelClasses = `block sometimes-bold w-auto uppercase pl-1${
    mounted && isVisible
      ? ` font-extrabold${fixedSize ? "" : " dash:font-semibold"}`
      : " text-content-muted"
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
      {symbolStyle === "area" ? (
        <LegendAreaGraphIcon className={iconClasses} />
      ) : (
        <LegendLineGraphIcon className={iconClasses} dashStyle={symbolStyle} />
      )}
      {labelControl ? (
        <div className="inline-flex flex-1 pl-1 leading-tight">{labelControl}</div>
      ) : (
        <button
          className={`inline-flex flex-1 text-left pl-1 max-w-full w-auto leading-tight text-2xs @lg:pr-1 @xl:pr-0 @xl:text-2xs${
            fixedSize ? "" : " dash:text-base dash:tracking-wider dash:pb-1"
          }`}
          onClick={toggleLineVisibility}
        >
          <span className={labelClasses}>{label}</span>
        </button>
      )}
      <Toggle onClick={toggleLineVisibility} visible={mounted && isVisible} />
    </div>
  );
};

export default LegendItem;
