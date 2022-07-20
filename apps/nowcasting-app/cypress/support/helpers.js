import {
  addMinutesToISODate,
  convertISODateStringToLondonTime,
  formatISODateStringHuman,
  get30MinNow,
} from "../../components/utils";
export const getTimeFormats = (date, addMinutes) => {
  let datePlus = date;
  if (addMinutes) {
    datePlus = new Date(addMinutesToISODate(datePlus.toISOString(), addMinutes));
  }
  const _30minNow = get30MinNow(datePlus);
  const londonTime = convertISODateStringToLondonTime(_30minNow);
  const londonDateTime = formatISODateStringHuman(_30minNow);
  return { londonTime, londonDateTime };
};
