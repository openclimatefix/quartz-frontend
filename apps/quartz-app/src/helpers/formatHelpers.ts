// Missing values should be written as null, not 0 or NaN. Downstream consumers
// (e.g. Recharts, whose connectNulls defaults to false) distinguish a real 0
// reading from a genuinely absent one, and treating them the same is wrong in
// both directions: raw `null / 1000` is 0 in JS (a fake reading that hides a
// gap) and `undefined / 1000` is NaN.
//
// Hence `!= null` rather than a truthy check: 0 is a legitimate reading (e.g.
// solar overnight) and must stay 0, while only genuinely absent values become
// null. A truthy check conflates the two.
export const KWtoMW = (
  powerKW: number | null | undefined,
  decimalPlaces?: number
): number | null => {
  if (powerKW == null) return null;

  const MW = Number(powerKW) / 1000;
  return decimalPlaces != null ? Number(MW.toFixed(decimalPlaces)) : MW;
};
