import { CombinedData } from "../types";
import { DateTime } from "luxon";
import { CSVColumn } from "../layout/header/csvDownloadModal";
import { getSettlementPeriodForDate } from "./chartUtils";

interface CSVRow {
  startDateTime: string;
  endDateTime: string;
  settlementPeriod: number | null;
  solarGenerationPvliveInitial: number | null;
  solarGenerationPvliveUpdated: number | null;
  delta: number | null;
  solarForecast: number | null;
  nForecast: number | null;
  pLevelValues: Record<number, number | null>;
}

export const getNHourForecastLabel = (nHourForecast: number) => `${nHourForecast}-hour forecast`;

const getColumnConfig = (
  nHourForecast: number
): Record<
  Exclude<CSVColumn, "pLevels">,
  { key: keyof Omit<CSVRow, "pLevelValues">; header: string }
> => ({
  startDateTime: { key: "startDateTime", header: "Start DateTime" },
  endDateTime: { key: "endDateTime", header: "End DateTime" },
  settlementPeriod: { key: "settlementPeriod", header: "Settlement Period" },
  solarGenerationPvliveInitial: {
    key: "solarGenerationPvliveInitial",
    header: "Solar Generation PVLive Initial (MW)"
  },
  solarGenerationPvliveUpdated: {
    key: "solarGenerationPvliveUpdated",
    header: "Solar Generation PVLive Updated (MW)"
  },
  delta: { key: "delta", header: "Delta (MW)" },
  solarForecast: { key: "solarForecast", header: "Solar Forecast (MW)" },
  nForecast: {
    key: "nForecast",
    header: `${getNHourForecastLabel(nHourForecast)} (MW)`
  }
});

const createEmptyRow = (timestamp: string): CSVRow => {
  const end = DateTime.fromISO(timestamp).setZone("Europe/London");
  const start = end.minus({ minutes: 30 });
  const settlementPeriod = getSettlementPeriodForDate(start);

  return {
    startDateTime: start.toISO() || "",
    endDateTime: end.toISO() || "",
    settlementPeriod,
    solarGenerationPvliveInitial: null,
    solarGenerationPvliveUpdated: null,
    delta: null,
    solarForecast: null,
    nForecast: null,
    pLevelValues: {}
  };
};

const getOrCreateRow = (map: Map<string, CSVRow>, ts: string): CSVRow => {
  if (!map.has(ts)) {
    map.set(ts, createEmptyRow(ts));
  }
  return map.get(ts)!;
};

export const downloadNationalCsv = (
  combinedData: CombinedData | null,
  selectedColumns: CSVColumn[],
  nHourForecast: number,
  pLevels: [number, number][]
) => {
  if (!combinedData) return;

  const dataByTimestamp = new Map<string, CSVRow>();

  // PV initial
  combinedData.pvRealDayInData?.forEach((entry) => {
    const row = getOrCreateRow(dataByTimestamp, entry.datetimeUtc);
    row.solarGenerationPvliveInitial = entry.solarGenerationKw
      ? entry.solarGenerationKw / 1000
      : null;
  });

  // PV updated
  combinedData.pvRealDayAfterData?.forEach((entry) => {
    const row = getOrCreateRow(dataByTimestamp, entry.datetimeUtc);
    row.solarGenerationPvliveUpdated = entry.solarGenerationKw
      ? entry.solarGenerationKw / 1000
      : null;
  });

  const updateRowDelta = (row: CSVRow) => {
    const actualMw = row.solarGenerationPvliveUpdated ?? row.solarGenerationPvliveInitial;
    row.delta =
      actualMw !== null && row.solarForecast !== null ? actualMw - row.solarForecast : null;
  };

  // Forecast
  combinedData.nationalForecastData?.forEach((entry) => {
    const row = getOrCreateRow(dataByTimestamp, entry.targetTime);
    row.solarForecast = entry.expectedPowerGenerationMegawatts;
    const plevelValues = entry.plevels as Record<string, number | undefined> | undefined;
    pLevels.flat().forEach((level) => {
      row.pLevelValues[level] = plevelValues?.[`plevel_${level}`] ?? null;
    });
  });

  // N forecast
  combinedData.nationalNHourData?.forEach((entry) => {
    const row = getOrCreateRow(dataByTimestamp, entry.targetTime);
    row.nForecast = entry.expectedPowerGenerationMegawatts;
  });

  dataByTimestamp.forEach((row) => updateRowDelta(row));

  // sort + build rows
  const csvRows = Array.from(dataByTimestamp.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => row);

  const csv = generateCsv(csvRows, selectedColumns, nHourForecast, pLevels);

  // download
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;

  const now = DateTime.now().toLocal().toFormat("yyyy-MM-dd_HH-mm-ssZZZ");
  a.download = `Quartz_National_${now}.csv`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

function generateCsv(
  rows: CSVRow[],
  selectedColumns: CSVColumn[],
  nHourForecast: number,
  pLevels: [number, number][]
): string {
  const COLUMN_CONFIG = getColumnConfig(nHourForecast);
  const pLevelLevels = pLevels.flat();

  // "pLevels" is a single selectable column that expands to one header/value per selected band
  const getHeaders = (col: CSVColumn): string[] =>
    col === "pLevels"
      ? pLevelLevels.map((level) => `Solar Forecast P${level} (MW)`)
      : [COLUMN_CONFIG[col].header];

  const getValues = (row: CSVRow, col: CSVColumn): (number | string | null)[] =>
    col === "pLevels"
      ? pLevelLevels.map((level) => row.pLevelValues[level] ?? "")
      : [row[COLUMN_CONFIG[col].key] ?? ""];

  const headers = selectedColumns.flatMap(getHeaders);
  const lines = rows.map((row) => selectedColumns.flatMap((col) => getValues(row, col)).join(","));

  return [headers.join(","), ...lines].join("\n");
}
