export type HistoryStartType = "fixed" | "rolling";

/**
 * Returns the start Date for the UI history window.
 *  - rolling: now - OFFSET hours
 *  - fixed:   midnight (UTC) N days ago, where N = round(OFFSET/24), min 1
 */
export function getHistoryStart(now = new Date()): Date {
  const rawType = (
    process.env.NEXT_PUBLIC_HISTORY_START_TYPE ?? "rolling"
  ).toLowerCase();
  const type: HistoryStartType = rawType === "fixed" ? "fixed" : "rolling";

  const offsetStr = process.env.NEXT_PUBLIC_HISTORY_START_OFFSET_HOURS ?? "48";
  const offsetHours = Number(offsetStr);
  const safeOffset =
    Number.isFinite(offsetHours) && offsetHours > 0 ? offsetHours : 48;

  if (type === "fixed") {
    const days = Math.max(1, Math.round(safeOffset / 24));
    const midnightTodayUTC = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );
    midnightTodayUTC.setUTCDate(midnightTodayUTC.getUTCDate() - days);
    return midnightTodayUTC;
  }

  // rolling
  return new Date(now.getTime() - safeOffset * 3600 * 1000);
}

export const getHistoryStartISO = (now?: Date) =>
  getHistoryStart(now).toISOString();
