import { DateTime } from "luxon";
import { CSVColumn } from "../layout/header/csvDownloadModal";
import { getSettlementPeriodForDate } from "./chartUtils";
import type { TimeSeries } from "../../lib/domain/types";

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
 * The v1 series the national CSV is built from — the same canonical `TimeSeries` shape the
 * national chart and the delta view's top chart fetch, not `CombinedData`.
 *
 * `generationInitial`/`generationUpdated` are the country's first and second observer, in
 * manifest order — GB's `pvlive_in_day`/`pvlive_day_after`, matching `GENERATION_CHART_KEYS`
 * in `pv-remix-chart.tsx`. A single-observer country (NL) leaves `generationUpdated`
 * undefined, and its column comes back empty rather than waiting forever.
 */
export type NationalCsvSeries = {
  forecast?: TimeSeries;
  generationInitial?: TimeSeries;
  generationUpdated?: TimeSeries;
  nHour?: TimeSeries;
};

/**
 * Pure row-building half of the national CSV export: fans the configured series out into one
 * row per timestamp, merged on the timestamp string.
 */
export const buildCsvRows = (
  series: NationalCsvSeries,
  pLevels: [number, number][],
  timezone: string = DEFAULT_CSV_TIMEZONE
): CSVRow[] => {
  const dataByTimestamp = new Map<string, CSVRow>();

  // PV initial
  series.generationInitial?.values.forEach((point) => {
    const row = getOrCreateRow(dataByTimestamp, point.timeUtc, timezone);
    // absent ≠ null ≠ zero: `powerMw` is already `number | null` MW off the v1 boundary, so a
    // genuine 0 MW overnight reading is preserved exactly, not coerced to a blank cell.
    row.solarGenerationPvliveInitial = point.powerMw;
  });

  // PV updated
  series.generationUpdated?.values.forEach((point) => {
    const row = getOrCreateRow(dataByTimestamp, point.timeUtc, timezone);
    row.solarGenerationPvliveUpdated = point.powerMw;
  });

  const updateRowDelta = (row: CSVRow) => {
    const actualMw = row.solarGenerationPvliveUpdated ?? row.solarGenerationPvliveInitial;
    row.delta =
      actualMw !== null && row.solarForecast !== null ? actualMw - row.solarForecast : null;
  };

  // Forecast
  series.forecast?.values.forEach((point) => {
    const row = getOrCreateRow(dataByTimestamp, point.timeUtc, timezone);
    row.solarForecast = point.powerMw;
    pLevels.flat().forEach((level) => {
      row.pLevelValues[level] = point.plevelsMw?.[String(level)] ?? null;
    });
  });

  // N forecast
  series.nHour?.values.forEach((point) => {
    const row = getOrCreateRow(dataByTimestamp, point.timeUtc, timezone);
    row.nForecast = point.powerMw;
  });

  dataByTimestamp.forEach((row) => updateRowDelta(row));

  // sort + build rows
  return Array.from(dataByTimestamp.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => row);
};

export const downloadNationalCsv = (
  series: NationalCsvSeries,
  selectedColumns: CSVColumn[],
  nHourForecast: number,
  pLevels: [number, number][],
  timezone: string = DEFAULT_CSV_TIMEZONE
) => {
  if (!series.forecast && !series.generationInitial && !series.generationUpdated && !series.nHour)
    return;

  const csvRows = buildCsvRows(series, pLevels, timezone);
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
