import { CombinedData } from "../types";
import { DateTime } from "luxon";
import { CSVColumn } from "../layout/header/csv-download-modal";
import { getSettlementPeriodForDate } from "./chartUtils";

interface CSVRow {
  startDateTime: string;
  endDateTime: string;
  settlementPeriod: number | null;
  solarGenerationPvliveInitial: number | null;
  solarGenerationPvliveUpdated: number | null;
  solarForecast: number | null;
  solarForecastP10: number | null;
  solarForecastP90: number | null;
  nForecast: number | null;
}

const COLUMN_CONFIG: Record<CSVColumn, { key: keyof CSVRow; header: string }> = {
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
  solarForecast: { key: "solarForecast", header: "Solar Forecast (MW)" },
  solarForecastP10: { key: "solarForecastP10", header: "Solar Forecast P10 (MW)" },
  solarForecastP90: { key: "solarForecastP90", header: "Solar Forecast P90 (MW)" },
  nForecast: { key: "nForecast", header: "N Forecast (MW)" }
};

const createEmptyRow = (timestamp: string): CSVRow => {
  const start = DateTime.fromISO(timestamp);
  const end = start.plus({ minutes: 30 });
  const settlementPeriod = getSettlementPeriodForDate(start);

  return {
    startDateTime: start.toISO() || "",
    endDateTime: end.toISO() || "",
    settlementPeriod,
    solarGenerationPvliveInitial: null,
    solarGenerationPvliveUpdated: null,
    solarForecast: null,
    solarForecastP10: null,
    solarForecastP90: null,
    nForecast: null
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
  selectedColumns: CSVColumn[]
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

  // Forecast
  combinedData.nationalForecastData?.forEach((entry) => {
    const row = getOrCreateRow(dataByTimestamp, entry.targetTime);
    row.solarForecast = entry.expectedPowerGenerationMegawatts;
    row.solarForecastP10 = entry.plevels?.plevel_10 ?? null;
    row.solarForecastP90 = entry.plevels?.plevel_90 ?? null;
  });

  // N forecast
  combinedData.nationalNHourData?.forEach((entry) => {
    const row = getOrCreateRow(dataByTimestamp, entry.targetTime);
    row.nForecast = entry.expectedPowerGenerationMegawatts;
  });

  // sort + build rows
  const csvRows = Array.from(dataByTimestamp.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => row);

  const csv = generateCsv(csvRows, selectedColumns);

  // download
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;

  const now = DateTime.now().toUTC().toFormat("yyyy-MM-dd_HH-mm");
  a.download = `Quartz-National-${now}.csv`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

function generateCsv(rows: CSVRow[], selectedColumns: CSVColumn[]): string {
  const headers = selectedColumns.map((col) => COLUMN_CONFIG[col].header);

  const lines = rows.map((row) =>
    selectedColumns
      .map((col) => {
        const value = row[COLUMN_CONFIG[col].key];
        return value ?? "";
      })
      .join(",")
  );

  return [headers.join(","), ...lines].join("\n");
}
