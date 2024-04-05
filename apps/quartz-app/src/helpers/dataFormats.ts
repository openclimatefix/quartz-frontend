export const KWtoMW = (KW: number, decimalPlaces?: number) => {
  if (decimalPlaces) return Number((Number(KW) / 1000).toFixed(decimalPlaces));

  return Number(KW) / 1000;
};
