import { DateTime } from "luxon";

export const convertDatestampToEpoch = (time: string) => {
  const date = new Date(time.slice(0, 16));
  return date.getTime();
};

export const formatEpochToDateTime = (time: number) => {
  const date = DateTime.fromMillis(time);
  return date.toFormat("dd/MM/yyyy HH:mm");
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
    millisecond: 0,
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
