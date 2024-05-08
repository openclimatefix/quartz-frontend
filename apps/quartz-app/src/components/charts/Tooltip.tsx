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
import { formatEpochToDateTime, isNow, isPast } from "@/src/helpers/datetime";
import {
  PowerIcon24,
  SolarIcon24,
  WindIcon24,
} from "@/src/components/icons/icons";
import { ITooltipRow } from "@/src/types/ui";

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

const getCombinedRowValue: (
  props: Pick<TooltipRowProps, "name" | "payload" | "timestamp">
) => string = ({ name, payload, timestamp }) => {
  if (!timestamp) return "No timestamp";
  let value = 0;
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
  if (windRow?.value) {
    value = Number(windRow.value);
  }
  if (solarRow?.value) {
    value = value += Number(solarRow.value);
  }
  if (isNow(timestamp) && name === "combined_forecast_future") {
    value = 0;
    value += Number(
      payload?.find((item) => item.dataKey === "wind_forecast_past")?.value
    );
    value += Number(
      payload?.find((item) => item.dataKey === "solar_forecast_past")?.value
    );
  }
  if (value === 0) {
    return "–";
  } else {
    return value.toFixed(0);
  }
};
const getTooltipRowFormattedValue: (
  props: TooltipRowProps & {
    rowData: Payload<ValueType, NameType> | undefined;
  }
) => string = ({ name, rowData, payload, generationType, timestamp }) => {
  if (!timestamp) return "No timestamp";
  let formattedValue = rowData?.value;
  if (generationType !== "combined" && rowData) {
    if (typeof rowData.value === "number") {
      formattedValue = rowData.value?.toFixed(0);
    }
    if (!rowData.value) {
      formattedValue = typeof rowData.value === "number" ? "0" : "No data";
    }
  } else {
    if (generationType === "combined") {
      formattedValue = getCombinedRowValue({ name, payload, timestamp });
    }
  }
  return formattedValue as string;
};
type TooltipRowProps = {
  name: keyof typeof TOOLTIP_DISPLAY_NAMES;
  generationType: "solar" | "wind" | "combined";
  dataType: "forecast" | "generation";
  timestamp?: number;
  payload?: Payload<ValueType, NameType>[];
};
const TooltipRow: FC<TooltipRowProps> = ({
  name,
  generationType,
  dataType,
  timestamp,
  payload,
}) => {
  const rowData = payload?.find((item) => item.dataKey === name);
  if (!rowData && generationType !== "combined") return null;
  if (!timestamp) return null;
  if (!isNow(timestamp) && isPast(timestamp) && name.includes("future"))
    return null;
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

  const formattedValue = getTooltipRowFormattedValue({
    name,
    rowData,
    payload,
    dataType,
    generationType,
    timestamp,
  });

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
  visibleLines?: string[];
}> = ({ payload, label, visibleLines }) => {
  const showCombined =
    visibleLines?.includes("Solar") && visibleLines.includes("Wind");
  const getPayloadValue = (
    name: string,
    payload: Payload<ValueType, NameType>[] | undefined
  ) => {
    const rowData = payload?.find((item) => item.dataKey === name);
    if (!rowData?.value) return;

    return Number(rowData.value);
  };
  // NB: have to use `as const` to make TypeScript assert the type correctly, instead of widening to `string`
  const solarRows: ITooltipRow[] = [
    {
      dataType: "generation",
      name: "solar_generation",
      value: getPayloadValue("solar_generation", payload),
    } as const,
    {
      dataType: "forecast",
      name: "solar_forecast_past",
      value: getPayloadValue("solar_forecast_past", payload),
    } as const,
    {
      dataType: "forecast",
      name: "solar_forecast_future",
      value: getPayloadValue("solar_forecast_future", payload),
    } as const,
  ].sort((a, b) => Number(b.value) - Number(a.value));
  const windRows: ITooltipRow[] = [
    {
      dataType: "generation",
      name: "wind_generation",
      value: getPayloadValue("wind_generation", payload),
    } as const,
    {
      dataType: "forecast",
      name: "wind_forecast_past",
      value: getPayloadValue("wind_forecast_past", payload),
    } as const,
    {
      dataType: "forecast",
      name: "wind_forecast_future",
      value: getPayloadValue("wind_forecast_future", payload),
    } as const,
  ].sort((a, b) => Number(b.value) - Number(a.value));
  const combinedRows: ITooltipRow[] = [
    {
      dataType: "generation",
      name: "combined_generation",
      value: Number(
        getCombinedRowValue({
          name: "combined_generation",
          payload,
          timestamp: label,
        })
      ),
    } as const,
    {
      dataType: "forecast",
      name: "combined_forecast_past",
      value: Number(
        getCombinedRowValue({
          name: "combined_forecast_past",
          payload,
          timestamp: label,
        })
      ),
    } as const,
    {
      dataType: "forecast",
      name: "combined_forecast_future",
      value: Number(
        getCombinedRowValue({
          name: "combined_forecast_future",
          payload,
          timestamp: label,
        })
      ),
    } as const,
  ].sort((a, b) => Number(b.value) - Number(a.value));
  console.log("combinedRows", combinedRows);

  return (
    <div className="flex flex-col bg-ocf-grey-900/60 text-white p-3 w-64">
      <div className="text-sm flex items-stretch justify-between">
        <span>{label ? formatEpochToDateTime(label) : "No timestamp"}</span>
        <span>MW</span>
      </div>
      {/* Combined Values */}
      {showCombined && (
        <>
          <TooltipHeader title={"Combined"} icon={<PowerIcon24 />} />
          {combinedRows.map((row) => (
            <TooltipRow
              key={`TooltipRow-${row.name}`}
              name={row.name}
              generationType={"combined"}
              dataType={row.dataType}
              timestamp={label}
              payload={payload}
            />
          ))}
        </>
      )}
      {/* Solar Values */}
      {visibleLines?.includes("Solar") && (
        <>
          <TooltipHeader title={"Solar"} icon={<SolarIcon24 />} />
          {solarRows.map((row) => (
            <TooltipRow
              key={`TooltipRow-${row.name}`}
              name={row.name}
              generationType={"solar"}
              dataType={row.dataType}
              timestamp={label}
              payload={payload}
            />
          ))}
        </>
      )}
      {/* Wind Values */}
      {visibleLines?.includes("Wind") && (
        <>
          <TooltipHeader title={"Wind"} icon={<WindIcon24 />} />
          {windRows.map((row) => (
            <TooltipRow
              key={`TooltipRow-${row.name}`}
              name={row.name}
              generationType={"wind"}
              dataType={row.dataType}
              timestamp={label}
              payload={payload}
            />
          ))}
        </>
      )}
    </div>
  );
};
