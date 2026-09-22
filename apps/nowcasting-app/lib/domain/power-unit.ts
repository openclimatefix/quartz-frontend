import { getCountryConfig, type PowerUnit } from "../../config/countries";

/**
 * Power figures are held in MW throughout the app and shown in the unit the country's
 * registry entry names. GB reads in MW, where NL and DE would otherwise show five digits
 * for a single region.
 *
 * Nothing here rounds for storage: these functions are the last step before a number is
 * written on screen, and every caller passes MW in.
 */

/** The unit a country's figures are written in; MW for a country with no registry entry. */
export const displayUnitFor = (country: string | null | undefined): PowerUnit =>
  getCountryConfig(country)?.displayUnit ?? "MW";

/** An MW value in `unit`. A GW figure is the same number divided by a thousand. */
export const toDisplayPower = (valueMW: number, unit: PowerUnit): number =>
  unit === "GW" ? valueMW / 1000 : valueMW;

/**
 * Decimals a figure carries in `unit`.
 *
 * A GW figure needs them — dropping them would round every GB-sized region to "0" — where an
 * MW figure is already whole-number precision at the scale it is read.
 */
export const displayDecimalsFor = (unit: PowerUnit): number => (unit === "GW" ? 2 : 0);
