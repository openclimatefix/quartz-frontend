import { DateTime } from "luxon";

/**
 * Gets the configurable history start mode from environment variables.
 * @returns "rolling" or "fixed"
 */
export const getHistoryStartMode = (): "rolling" | "fixed" => {
  const mode = process.env.NEXT_PUBLIC_HISTORY_START_MODE || "rolling";
  if (mode !== "rolling" && mode !== "fixed") {
    console.warn(
      `Invalid NEXT_PUBLIC_HISTORY_START_MODE: "${mode}". Defaulting to "rolling".`
    );
    return "rolling";
  }
  return mode;
};

/**
 * Gets the configurable history offset in hours from environment variables.
 * @returns offset in hours (default: 48)
 */
export const getHistoryOffsetHours = (): number => {
  const offsetStr = process.env.NEXT_PUBLIC_HISTORY_OFFSET_HOURS;
  const offset = offsetStr ? parseInt(offsetStr, 10) : 48;

  if (isNaN(offset) || offset < 0) {
    console.warn(
      `Invalid NEXT_PUBLIC_HISTORY_OFFSET_HOURS: "${offsetStr}". Defaulting to 48.`
    );
    return 48;
  }

  return offset;
};

/**
 * Calculates the history start timestamp.
 *
 * Modes:
 * - "rolling": offset hours back from now
 * - "fixed": midnight UTC N days ago (where N = offset hours / 24)
 *
 * @returns DateTime object representing the history start
 */
export const getHistoryStart = (): DateTime => {
  const mode = getHistoryStartMode();
  const offsetHours = getHistoryOffsetHours();

  if (mode === "fixed") {
    // Fixed: midnight UTC N days ago
    const daysAgo = Math.floor(offsetHours / 24);
    return DateTime.now().toUTC().minus({ days: daysAgo }).startOf("day");
  }

  // Rolling (default): now - offset hours
  return DateTime.now().toUTC().minus({ hours: offsetHours });
};

/**
 * Returns the history start as an ISO-8601 string for API queries.
 * @returns ISO string in UTC
 */
export const getHistoryStartISO = (): string => {
  return getHistoryStart().toISO();
};
