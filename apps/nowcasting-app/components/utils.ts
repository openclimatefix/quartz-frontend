export const allForecastsAccessor = (d: any) => d.forecastValues;
const forecastAccessor0 = (d: any) => d.forecastValues[0].expectedPowerGenerationMegawatts;
const forecastAccessor1 = (d: any) => d.forecastValues[1].expectedPowerGenerationMegawatts;
const forecastAccessor2 = (d: any) => d.forecastValues[2].expectedPowerGenerationMegawatts;
export const getForecastAccessorForTimeHorizon = (selectedTimeHorizon: number) => {
  switch (selectedTimeHorizon) {
    case 0:
      return forecastAccessor0;
    case 1:
      return forecastAccessor1;
    case 2:
      return forecastAccessor2;
  }
};

export const classNames = (...classes: string[]) => {
  return classes.filter(Boolean).join(" ");
};

/**
 * @param date Date object
 * @returns HH:MM representation of the date, as string
 */
export const getTimeFromDate = (date: Date) => {
  return date.toTimeString().split(" ")[0].slice(0, -3);
};
export const formatISODateString = (date: string) => {
   // Changes the ISO date string to Europe London time, and remove timezone and seconds

  const dateid = date?.slice(0, 16);

  const d = new Date(date);
  const date_london_date_str = d.toLocaleDateString("en-GB", {timeZone: 'Europe/London'})
  // make string in DD/MM/YYYY format
  const date_london_time_str = d.toLocaleTimeString("en-GB", {timeZone: 'Europe/London'}).slice(0,5)
  // make string in HH:MM format
  const year = date_london_date_str.slice(6,10)
  const month = date_london_date_str.slice(3,5)
  const day = date_london_date_str.slice(0,2)

  const london_datetime = `${year}-${month}-${day}T${date_london_time_str}`

  return london_datetime
};

export const formatISODateStringHuman = (date: string) => {
    // Change date to nice human readable format.
    // Note that this converts the string to Europe London Time
    // timezone and seconds are removed
    const d = new Date(date);
    const date_london = d.toLocaleDateString("en-GB", {timeZone: 'Europe/London'});
    const date_london_time = d.toLocaleTimeString("en-GB", {timeZone: 'Europe/London'}).slice(0,5);

    // further formatting could be done to make it yyyy/mm/dd HH:MM
    return `${date_london} ${date_london_time}`
};

