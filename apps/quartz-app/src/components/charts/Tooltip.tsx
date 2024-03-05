import { FC, ReactNode } from "react";
import {
  NameType,
  Payload,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import {
  ACTUAL_COLOR,
  SOLAR_COLOR,
  TOOLTIP_DISPLAY_NAMES,
  WIND_COLOR,
} from "@/src/constants";
import { formatEpochToDateTime, isPast } from "@/src/helpers/datetime";
import { SolarIcon24, WindIcon24 } from "@/src/components/icons/icons";

const TooltipHeader: FC<{ title: string; icon: ReactNode }> = ({
  title,
  icon,
}) => {
  return (
    <div className="text-lg flex justify-between items-center mt-2 mb-1">
      <span className="flex-initial">{title}</span>
      <hr className="flex-1 mx-2" />
      <span className="flex-initial">{icon}</span>
    </div>
  );
};

const TooltipRow: FC<{
  name: keyof typeof TOOLTIP_DISPLAY_NAMES;
  generationType: "solar" | "wind";
  dataType: "forecast" | "generation";
  timestamp?: number;
  payload?: Payload<ValueType, NameType>[];
}> = ({ name, generationType, dataType, timestamp, payload }) => {
  const rowData = payload?.find((item) => item.dataKey === name);
  if (!rowData) return null;
  if (!timestamp) return null;
  if (isPast(timestamp) && name.includes("future")) return null;
  if (!isPast(timestamp) && name.includes("past")) return null;

  const prettyName = TOOLTIP_DISPLAY_NAMES[name];
  let color = generationType === "solar" ? SOLAR_COLOR : WIND_COLOR;
  if (dataType === "generation") color = ACTUAL_COLOR;

  let formattedValue = rowData.value;
  if (typeof rowData.value === "number") {
    formattedValue = rowData.value?.toFixed(0);
  }
  if (!rowData.value) {
    formattedValue = "–";
  }

  return (
    <div className="text-sm flex justify-between" style={{ color }}>
      <span>{prettyName}</span>
      <span>{formattedValue}</span>
    </div>
  );
};

export const TooltipContent: FC<{
  payload?: Payload<ValueType, NameType>[];
  label?: number;
}> = ({ payload, label }) => {
  return (
    <div className="flex flex-col bg-ocf-grey-900/60 text-white p-3 w-64">
      <div className="text-sm flex items-stretch justify-between">
        <span>{label ? formatEpochToDateTime(label) : "No timestamp"}</span>
        <span>MW</span>
      </div>
      {/* Wind Values */}
      <TooltipHeader title={"Wind"} icon={<WindIcon24 />} />
      <TooltipRow
        name="wind_generation"
        generationType={"wind"}
        dataType={"generation"}
        timestamp={label}
        payload={payload}
      />
      <TooltipRow
        name="wind_forecast_past"
        generationType={"wind"}
        dataType={"forecast"}
        timestamp={label}
        payload={payload}
      />
      <TooltipRow
        name="wind_forecast_future"
        generationType={"wind"}
        dataType={"forecast"}
        timestamp={label}
        payload={payload}
      />
      {/* Solar Values */}
      <TooltipHeader title={"Solar"} icon={<SolarIcon24 />} />
      <TooltipRow
        name="solar_generation"
        generationType={"solar"}
        dataType={"generation"}
        timestamp={label}
        payload={payload}
      />
      <TooltipRow
        name="solar_forecast_past"
        generationType={"solar"}
        dataType={"forecast"}
        timestamp={label}
        payload={payload}
      />
      <TooltipRow
        name="solar_forecast_future"
        generationType={"solar"}
        dataType={"forecast"}
        timestamp={label}
        payload={payload}
      />
    </div>
  );
};
