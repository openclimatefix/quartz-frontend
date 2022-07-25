const convertISODateStringToLondonTime = (date) => {
  // Changes the ISO date string to Europe London time, and return time only
  const d = new Date(date);
  const date_london_time_str = d
    .toLocaleTimeString("en-GB", { timeZone: "Europe/London" })
    .slice(0, 5);

  return date_london_time_str;
};

const formatISODateStringHuman = (date) => {
  // Change date to nice human readable format.
  // Note that this converts the string to Europe London Time
  // timezone and seconds are removed
  const d = new Date(date);
  const date_london = d.toLocaleDateString("en-GB", { timeZone: "Europe/London" });
  const date_london_time = d.toLocaleTimeString("en-GB", { timeZone: "Europe/London" }).slice(0, 5);

  // further formatting could be done to make it yyyy/mm/dd HH:MM
  return `${date_london} ${date_london_time}`;
};

const addMinutesToISODate = (date, munites) => {
  var d = new Date(date);
  d.setMinutes(d.getMinutes() + munites);
  return d.toISOString();
};

function get30MinNow(d) {
  // this is a function to get the date of now, but rounded up to the closest 30 minutes
  const date = d || new Date();
  const minites = date.getMinutes();
  if (minites <= 30) {
    date.setHours(date.getHours());
    date.setMinutes(30, 0, 0); // Resets also seconds and milliseconds
  } else {
    date.setHours(date.getHours() + 1);
    date.setMinutes(0, 0, 0); // Resets also seconds and milliseconds
  }
  return date.toISOString();
}

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

export const playInterval = 2000;
export const now = 1657202700000;
