import { FC, ReactNode } from "react";
import {
  NameType,
  Payload,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import {
  ACTUAL_COLOR,
  ACTUAL_SOLAR_COLOR,
  ACTUAL_WIND_COLOR,
  COMBINED_COLOR,
  SOLAR_COLOR,
  TOOLTIP_DISPLAY_NAMES,
  WIND_COLOR,
} from "@/src/constants";
import { formatEpochToDateTime, isPast } from "@/src/helpers/datetime";
import {
  PowerIcon24,
  SolarIcon24,
  WindIcon24,
} from "@/src/components/icons/icons";

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
  generationType: "solar" | "wind" | "combined";
  dataType: "forecast" | "generation";
  timestamp?: number;
  payload?: Payload<ValueType, NameType>[];
}> = ({ name, generationType, dataType, timestamp, payload }) => {
  const rowData = payload?.find((item) => item.dataKey === name);
  if (!rowData && generationType !== "combined") return null;
  if (!timestamp) return null;
  if (isPast(timestamp) && name.includes("future")) return null;
  if (!isPast(timestamp) && name.includes("past")) return null;

  const prettyName = TOOLTIP_DISPLAY_NAMES[name];
  let color = ACTUAL_COLOR;
  switch (generationType) {
    case "solar":
      color = dataType === "forecast" ? SOLAR_COLOR : ACTUAL_SOLAR_COLOR;
      break;
    case "wind":
      color = dataType === "forecast" ? WIND_COLOR : ACTUAL_WIND_COLOR;
      break;
    case "combined":
      color = dataType === "forecast" ? COMBINED_COLOR : ACTUAL_COLOR;
      break;
  }

  let formattedValue = rowData?.value;
  if (generationType !== "combined" && rowData) {
    if (typeof rowData.value === "number") {
      formattedValue = rowData.value?.toFixed(0);
    }
    if (!rowData.value) {
      formattedValue = "–";
    }
  } else {
    if (generationType === "combined") {
      formattedValue = 0;
      let windKey = "wind_generation";
      let solarKey = "solar_generation";
      switch (name) {
        case "combined_generation":
          break;
        case "combined_forecast_past":
          windKey = "wind_forecast_past";
          solarKey = "solar_forecast_past";
          break;
        case "combined_forecast_future":
          windKey = "wind_forecast_future";
          solarKey = "solar_forecast_future";
          break;
      }
      const windRow = payload?.find((item) => item.dataKey === windKey);
      const solarRow = payload?.find((item) => item.dataKey === solarKey);
      if (windRow) {
        formattedValue = Number(windRow.value);
      }
      if (solarRow) {
        formattedValue = formattedValue += Number(solarRow.value);
      }
      if (formattedValue === 0) {
        formattedValue = "–";
      } else {
        formattedValue = formattedValue.toFixed(0);
      }
    }
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
      {/* Combined Values */}
      <TooltipHeader title={"Combined"} icon={<PowerIcon24 />} />
      <TooltipRow
        name="combined_generation"
        generationType={"combined"}
        dataType={"generation"}
        timestamp={label}
        payload={payload}
      />
      <TooltipRow
        name="combined_forecast_past"
        generationType={"combined"}
        dataType={"forecast"}
        timestamp={label}
        payload={payload}
      />
      <TooltipRow
        name="combined_forecast_future"
        generationType={"combined"}
        dataType={"forecast"}
        timestamp={label}
        payload={payload}
      />
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
