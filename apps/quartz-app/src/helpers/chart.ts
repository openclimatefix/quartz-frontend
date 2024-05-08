/**
 * Calculates the domain for a chart axis with an upper buffer.
 *
 * @param dataMax - The maximum data value that will be plotted on the chart.
 * @param roundingTickAmount - The value to which the maximum data value should be rounded up.
 * @param buffer - The buffer amount to be added to the maximum data value before rounding.
 * @returns An array where the first element is the minimum domain value (always 0)
 * and the second element is the maximum domain value, calculated by
 * rounding up the sum of the maximum data value and the buffer to the
 * nearest multiple of the rounding tick amount.
 */
export const getDomainWithUpperBuffer = (
  dataMax: number,
  roundingTickAmount: number,
  buffer: number
): [number, number] => {
  if (roundingTickAmount <= 0) return [0, dataMax + buffer];
  const roundedMax =
    Math.ceil((dataMax + buffer) / roundingTickAmount) * roundingTickAmount;
  return [0, roundedMax];
};
