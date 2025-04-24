// tools for the chart
import { ChartData } from "../charts/remix-line";

// get the zoomYMax for either sites or national view
export const getZoomYMax = (filteredPreppedData: ChartData[]) => {
  // if no probabilistic max value, get the max between the generation and the forecast as the zoomYMax
  if (!filteredPreppedData.some((d) => d.PROBABILISTIC_UPPER_BOUND)) {
    let genMax =
      filteredPreppedData
        .map((d) => d.GENERATION_UPDATED || d.GENERATION)
        .filter((n) => typeof n === "number")
        .sort((a, b) => Number(b) - Number(a))[0] || 0;
    let forecastMax =
      filteredPreppedData
        .map((d) => d.PAST_FORECAST || d.FORECAST)
        .sort((a, b) => Number(b) - Number(a))[0] || 0;
    return Math.max(genMax, forecastMax);
  } else {
    return filteredPreppedData
      .map((d) => d.PROBABILISTIC_UPPER_BOUND || d.GENERATION)
      .filter((n) => typeof n === "number")
      .sort((a, b) => Number(b) - Number(a))[0];
  }
};

// Function not "in use" but useful for regenerating yMax levels as a constant array for the chart
export const generateYMaxTickArray = () => {
  // Generate yMax levels
  // Small values
  let yMax_levels = Array.from({ length: 4 }, (_, i) => i + 1);
  // Multiples of 3
  yMax_levels = [...yMax_levels, ...Array.from({ length: 6 }, (_, i) => (i + 1) * 3)];
  // Multiples of 5
  yMax_levels = [...yMax_levels, ...Array.from({ length: 6 }, (_, i) => (i + 1) * 5)];
  // Multiples of 10
  yMax_levels = [...yMax_levels, ...Array.from({ length: 5 }, (_, i) => (i + 1) * 10)];
  // Multiples of 15
  yMax_levels = [...yMax_levels, ...Array.from({ length: 6 }, (_, i) => (i + 1) * 15)];
  // Multiples of 20
  yMax_levels = [...yMax_levels, ...Array.from({ length: 5 }, (_, i) => (i + 1) * 20)];
  // Multiples of 25
  yMax_levels = [...yMax_levels, ...Array.from({ length: 3 }, (_, i) => (i + 1) * 25)];
  // Multiples of 50
  yMax_levels = [...yMax_levels, ...Array.from({ length: 10 }, (_, i) => (i + 1) * 50)];
  // Multiples of 100
  yMax_levels = [...yMax_levels, ...Array.from({ length: 10 }, (_, i) => (i + 1) * 100)];
  // Multiples of 500
  yMax_levels = [...yMax_levels, ...Array.from({ length: 10 }, (_, i) => (i + 1) * 500)];
  // Multiples of 1000
  yMax_levels = [...yMax_levels, ...Array.from({ length: 15 }, (_, i) => (i + 1) * 1000)];
  // Multiples of 2500
  yMax_levels = [...yMax_levels, ...Array.from({ length: 5 }, (_, i) => (i + 1) * 2500)];
  // Remove duplicates
  yMax_levels = [...new Set(yMax_levels)];
  // Sort
  yMax_levels.sort((a, b) => a - b);
  return yMax_levels;
};

export const getTicks = (yMax: number, yMax_levels: number[]) => {
  if (yMax === 13000 || yMax === 14000) {
    return [3000, 6000, 9000, 12000];
  }
  const ticks: number[] = [];
  const third = yMax / 3;
  const quarter = yMax / 4;
  const fifth = yMax / 5;
  const sixth = yMax / 6;
  const seventh = yMax / 7;
  const testTicksToAdd = (fractionN: number) => {
    if (!Number.isFinite(fractionN)) return;
    if (fractionN > 0) {
      let canSplit = true;
      let tempTicks = [];
      for (let i = fractionN; i <= yMax; i += fractionN) {
        /*
         TODO: this could check against the yMax_levels array / constant for strictly sticking
         to the levels we want to show; but we need to be careful not to inhibit the default
          behaviour of the chart library doing its job.
        */
        if (isRoundNumber(i) || i === yMax) {
          tempTicks.push(i);
        } else {
          canSplit = false;
          break;
        }
      }
      if (canSplit) {
        ticks.push(...tempTicks);
      }
    }
  };
  const isRoundNumber = (n: number) => {
    if (n > 2000) {
      return n % 2500 === 0 || n % 1000 === 0;
    }
    if (n > 1000) {
      return n % 250 === 0 || n % 100 === 0;
    }
    if (n > 200) {
      return n % 50 === 0;
    }
    if (n > 20) {
      return n % 5 === 0;
    }
    if (n > 3) {
      return n % 1 === 0;
    }
    return n % 0.5 === 0;
  };
  if (ticks.length === 0 && isRoundNumber(fifth)) {
    testTicksToAdd(fifth);
  }
  if (ticks.length === 0 && isRoundNumber(sixth)) {
    testTicksToAdd(sixth);
  }
  if (ticks.length === 0 && isRoundNumber(quarter)) {
    testTicksToAdd(quarter);
  }
  if (ticks.length === 0 && isRoundNumber(third)) {
    testTicksToAdd(third);
  }
  if (ticks.length === 0 && isRoundNumber(seventh)) {
    testTicksToAdd(seventh);
  }
  if (ticks.length === 0) {
    testTicksToAdd(yMax > 500 ? 100 : yMax > 10 ? 50 : 0.5);
  }
  return ticks;
};
