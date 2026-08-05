import { CombinedData } from "../types";
import { DateTime } from "luxon";
import { CSVColumn } from "../layout/header/csvDownloadModal";
import { getSettlementPeriodForDate } from "./chartUtils";

export interface CSVRow {
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

// Phase 3: the zone the export renders its datetimes in, and counts settlement periods from,
// comes from the country registry. Defaulted so existing call sites are unchanged.
export const DEFAULT_CSV_TIMEZONE = "Europe/London";

const createEmptyRow = (timestamp: string, timezone: string): CSVRow => {
  const end = DateTime.fromISO(timestamp).setZone(timezone);
  const start = end.minus({ minutes: 30 });
  const settlementPeriod = getSettlementPeriodForDate(start, timezone);

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

const getOrCreateRow = (map: Map<string, CSVRow>, ts: string, timezone: string): CSVRow => {
  if (!map.has(ts)) {
    map.set(ts, createEmptyRow(ts, timezone));
  }
  return map.get(ts)!;
};

/**
 * Pure row-building half of the national CSV export: fans the various series in
 * `combinedData` out into one row per timestamp, merged on the timestamp string.
 */
export const buildCsvRows = (
  combinedData: CombinedData | null,
  pLevels: [number, number][],
  timezone: string = DEFAULT_CSV_TIMEZONE
): CSVRow[] => {
  if (!combinedData) return [];

  const dataByTimestamp = new Map<string, CSVRow>();

  // PV initial
  combinedData.pvRealDayInData?.forEach((entry) => {
    const row = getOrCreateRow(dataByTimestamp, entry.datetimeUtc, timezone);
    // B8: nullish check, not truthiness — a genuine 0 kW reading (every overnight
    // settlement period) must export as 0, not as a blank cell.
    row.solarGenerationPvliveInitial =
      entry.solarGenerationKw != null ? entry.solarGenerationKw / 1000 : null;
  });

  // PV updated
  combinedData.pvRealDayAfterData?.forEach((entry) => {
    const row = getOrCreateRow(dataByTimestamp, entry.datetimeUtc, timezone);
    // B8: as above.
    row.solarGenerationPvliveUpdated =
      entry.solarGenerationKw != null ? entry.solarGenerationKw / 1000 : null;
  });

  const updateRowDelta = (row: CSVRow) => {
    const actualMw = row.solarGenerationPvliveUpdated ?? row.solarGenerationPvliveInitial;
    row.delta =
      actualMw !== null && row.solarForecast !== null ? actualMw - row.solarForecast : null;
  };

  // Forecast
  combinedData.nationalForecastData?.forEach((entry) => {
    const row = getOrCreateRow(dataByTimestamp, entry.targetTime, timezone);
    // `?? null` keeps a legitimate 0 MW forecast and normalises a missing value to null.
    row.solarForecast = entry.expectedPowerGenerationMegawatts ?? null;
    const plevelValues = entry.plevels as Record<string, number | undefined> | undefined;
    pLevels.flat().forEach((level) => {
      row.pLevelValues[level] = plevelValues?.[`plevel_${level}`] ?? null;
    });
  });

  // N forecast
  combinedData.nationalNHourData?.forEach((entry) => {
    const row = getOrCreateRow(dataByTimestamp, entry.targetTime, timezone);
    row.nForecast = entry.expectedPowerGenerationMegawatts ?? null;
  });

  dataByTimestamp.forEach((row) => updateRowDelta(row));

  // sort + build rows
  return Array.from(dataByTimestamp.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => row);
};

export const downloadNationalCsv = (
  combinedData: CombinedData | null,
  selectedColumns: CSVColumn[],
  nHourForecast: number,
  pLevels: [number, number][],
  timezone: string = DEFAULT_CSV_TIMEZONE
) => {
  if (!combinedData) return;

  const csvRows = buildCsvRows(combinedData, pLevels, timezone);
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

export function generateCsv(
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
  const lines = rows.map((row) =>
    joinCsvRow(selectedColumns.flatMap((col) => getValues(row, col)))
  );

  return [joinCsvRow(headers), ...lines].join("\n");
}

/**
 * RFC 4180 escaping, applied at the single point where cells are joined: a cell containing a
 * comma, a double quote, CR or LF is wrapped in quotes and its own quotes are doubled. Every cell
 * is a number or an ISO datetime today, so nothing changes — but Phase 3 puts country and region
 * labels into this file, and one label with a comma in it would silently shift every column after
 * it on that row.
 */
const escapeCsvCell = (cell: number | string | null): string => {
  const value = cell === null ? "" : String(cell);
  return /["\r\n,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
};

const joinCsvRow = (cells: (number | string | null)[]): string =>
  cells.map(escapeCsvCell).join(",");
