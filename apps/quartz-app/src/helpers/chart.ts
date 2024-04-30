export const getDomainWithUpperBuffer = (
  [dataMin, dataMax]: [number, number],
  buffer: number
): [number, number] => {
  return [0, Math.floor((dataMax + buffer) / 1000) * 1000 + 1000];
};
