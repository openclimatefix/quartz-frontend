import { getDomainWithUpperBuffer } from "@/src/helpers/chart";

describe("Get Domain with upper buffer for chart", () => {
  it("should return the next closest 1000 above the dataMax", () => {
    const dataMax = 1800;
    const roundingTickAmount = 1000;
    const buffer = 100;
    const result = getDomainWithUpperBuffer(
      dataMax,
      roundingTickAmount,
      buffer
    );
    expect(result).toEqual([0, 2000]);
  });
  it("should return the next closest 1000 above the dataMax (larger max)", () => {
    const dataMax = 9500;
    const roundingTickAmount = 1000;
    const buffer = 100;
    const result = getDomainWithUpperBuffer(
      dataMax,
      roundingTickAmount,
      buffer
    );
    expect(result).toEqual([0, 10000]);
  });
  it("should return dataMax if is on a round x1000 and has no buffer", () => {
    const dataMax = 2000;
    const roundingTickAmount = 1000;
    const buffer = 0;
    const result = getDomainWithUpperBuffer(
      dataMax,
      roundingTickAmount,
      buffer
    );
    expect(result).toEqual([0, 2000]);
  });
  it("should return the tick if is exactly dataMax + buffer", () => {
    const dataMax = 1900;
    const roundingTickAmount = 1000;
    const buffer = 100;
    const result = getDomainWithUpperBuffer(
      dataMax,
      roundingTickAmount,
      buffer
    );
    expect(result).toEqual([0, 2000]);
  });
  it("should return the 1000 above if is on a buffer pushes into next band", () => {
    const dataMax = 1950;
    const roundingTickAmount = 1000;
    const buffer = 100;
    const result = getDomainWithUpperBuffer(
      dataMax,
      roundingTickAmount,
      buffer
    );
    expect(result).toEqual([0, 3000]);
  });
  it("should ignore the dataMin and always return 0", () => {
    const dataMax = 1800;
    const roundingTickAmount = 1000;
    const buffer = 100;
    const result = getDomainWithUpperBuffer(
      dataMax,
      roundingTickAmount,
      buffer
    );
    expect(result).toEqual([0, 2000]);
  });
  it("should return the dataMax + buffer if the roundingTickAmount is 0", () => {
    const dataMax = 1800;
    const roundingTickAmount = 0;
    const buffer = 100;
    const result = getDomainWithUpperBuffer(
      dataMax,
      roundingTickAmount,
      buffer
    );
    expect(result).toEqual([0, 1900]);
  });
  it("should return the dataMax + buffer if the roundingTickAmount is negative", () => {
    const dataMax = 1800;
    const roundingTickAmount = -1000;
    const buffer = 100;
    const result = getDomainWithUpperBuffer(
      dataMax,
      roundingTickAmount,
      buffer
    );
    expect(result).toEqual([0, 1900]);
  });
});
