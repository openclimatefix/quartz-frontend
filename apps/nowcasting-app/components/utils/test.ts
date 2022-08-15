import {
  addMinutesToISODate,
  getTimeFromDate,
  formatISODateString,
  convertISODateStringToLondonTime,
  formatISODateStringHuman,
  MWtoGW,
  KWtoGW,
} from ".";

describe("addMinutesToISODate", () => {
  it("adds minutes to date", () => {
    const date = "2020-01-01T00:00:00.000Z";
    const minutes = 10;
    const expected = "2020-01-01T00:10:00.000Z";
    expect(addMinutesToISODate(date, minutes)).toEqual(expected);
  });
});

describe("getTimeFromDate", () => {
  it("returns HH:MM representation of the date, as string", () => {
    const date = new Date("2020-01-01T10:00:00");
    const expected = "10:00";
    expect(getTimeFromDate(date)).toEqual(expected);
  });
});

describe("formatISODateString", () => {
  it("remove timezone", () => {
    const date = "2020-01-01T00:00:00.000Z";
    const expected = "2020-01-01T00:00";
    expect(formatISODateString(date)).toEqual(expected);
  });
});
describe("convertISODateStringToLondonTime", () => {
  it("Changes the ISO date string to Europe London time, and return time only", () => {
    const date = "2020-01-01T00:00:00.000Z";
    const expected = "00:00";
    expect(convertISODateStringToLondonTime(date)).toEqual(expected);
  });
});
describe("formatISODateStringHuman", () => {
  it("Change date to nice human readable format. Note that this converts the string to Europe London Time timezone and seconds are removed", () => {
    const date = "2020-01-01T10:00:00.000Z";
    const expected = "01/01/2020 10:00";
    expect(formatISODateStringHuman(date)).toEqual(expected);
  });
});
describe("MWtoGW", () => {
  it("returns rouned GW", () => {
    const MW = 1365;
    const expected = "1.4";
    expect(MWtoGW(MW)).toEqual(expected);
  });
});
describe("KWtoGW", () => {
  it("returns rouned GW", () => {
    const kw = 1365000;
    const expected = "1.4";
    expect(KWtoGW(kw)).toEqual(expected);
  });
});
