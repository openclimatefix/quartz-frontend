import { DateTime } from "luxon";

export const convertDatestampToEpoch = (time: string) => {
  const date = new Date(time.slice(0, 16));
  return date.getTime();
};

export const formatEpochToDateTime = (time: number) => {
  const date = DateTime.fromMillis(time);
  return date.toFormat("dd/MM/yyyy HH:mm");
};

export const formatEpochToDate = (time: number) => {
  const date = DateTime.fromMillis(time);
  return date.toFormat("dd/MM/yyyy");
};

export const formatEpochToDayName = (time: number) => {
  const date = DateTime.fromMillis(time);
  return date.toFormat("DDD");
};

export const formatEpochToHumanDayName = (time: number | undefined) => {
  if (!time) return "";

  const date = DateTime.fromMillis(time);
  const day = date.toLocaleString({ weekday: "short" });
  if (date.toFormat("DDD") === DateTime.now().toFormat("DDD")) {
    return "Today";
  }
  if (date.toFormat("DDD") === DateTime.now().plus({ days: 1 }).toFormat("DDD")) {
    return "Tomorrow";
  }
  return day;
};

export const formatEpochToPrettyTime = (time: number) => {
  const date = DateTime.fromMillis(time);
  return date.toFormat("HH:mm");
};

export const getNowInTimezone = () => {
  const now = DateTime.now().setZone("ist");
  return DateTime.fromISO(now.toString().slice(0, 16)).set({
    hour: now.minute >= 45 ? now.hour + 1 : now.hour,
    minute: now.minute < 45 ? Math.floor(now.minute / 15) * 15 : 0,
    second: 0,
    millisecond: 0
  });
};

export const getEpochNowInTimezone = () => {
  return getNowInTimezone().toMillis();
};

export const prettyPrintNowTime = () => {
  return getNowInTimezone().toFormat("HH:mm");
};

export const isPast = (timestamp: number) => {
  return timestamp < getEpochNowInTimezone();
};

export const isNow = (timestamp: number) => {
  return timestamp === getEpochNowInTimezone();
};
