import { getDomainWithUpperBuffer } from "@/src/helpers/chart";

describe("Get Domain with upper buffer for chart", () => {
  it("should return the next closest 1000 above the dataMax", () => {
    const dataMinMax: [number, number] = [0, 1800];
    const buffer = 100;
    const result = getDomainWithUpperBuffer(dataMinMax, buffer);
    expect(result).toEqual([0, 2000]);
  });
  it("should return the next closest 1000 above the dataMax (larger max)", () => {
    const dataMinMax: [number, number] = [0, 9500];
    const buffer = 100;
    const result = getDomainWithUpperBuffer(dataMinMax, buffer);
    expect(result).toEqual([0, 10000]);
  });
  it("should return dataMax + 1000 if is on a round x1000 and has no buffer", () => {
    const dataMinMax: [number, number] = [0, 2000];
    const buffer = 0;
    const result = getDomainWithUpperBuffer(dataMinMax, buffer);
    expect(result).toEqual([0, 3000]);
  });
  it("should return the 1000 above if buffer puts exactly on a x1000", () => {
    const dataMinMax: [number, number] = [0, 1900];
    const buffer = 100;
    const result = getDomainWithUpperBuffer(dataMinMax, buffer);
    expect(result).toEqual([0, 3000]);
  });
  it("should return the 1000 above if is on a buffer pushes into next band", () => {
    const dataMinMax: [number, number] = [0, 1950];
    const buffer = 100;
    const result = getDomainWithUpperBuffer(dataMinMax, buffer);
    expect(result).toEqual([0, 3000]);
  });
  it("should ignore the dataMin and always return 0", () => {
    const dataMinMax: [number, number] = [1000, 1800];
    const buffer = 100;
    const result = getDomainWithUpperBuffer(dataMinMax, buffer);
    expect(result).toEqual([0, 2000]);
  });
});
