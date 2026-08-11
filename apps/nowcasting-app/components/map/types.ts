import { ReactNode } from "react";

export enum ActiveUnit {
  MW = "MW",
  percentage = "%",
  capacity = "Capacity"
}

export enum SelectedData {
  expectedPowerGenerationNormalized = "expectedPowerGenerationNormalized",
  expectedPowerGenerationMegawatts = "expectedPowerGenerationMegawatts",
  expectedPowerGenerationMegawattsRounded = "expectedPowerGenerationMegawattsRounded",
  expectedPowerGenerationNormalizedRounded = "expectedPowerGenerationNormalizedRounded",
  actualPowerGenerationMegawatts = "actualPowerGenerationMegawatts",
  installedCapacityMw = "installedCapacityMw",
  delta = "delta"
}

export interface IMap {
  children?: ReactNode;
  loadDataOverlay: any;
  controlOverlay: any;
  bearing?: number;
  updateData: { newData: boolean | string; updateMapData: (map: mapboxgl.Map) => void };
  title: string;
}

/**
 * Identifies which map instance this is — a DOM id suffix (`#Map-${title}`) and the thing
 * `map.tsx` checks to decide whether the satellite cloud-layer control applies. Used to be the
 * `VIEWS` enum's three values, reused for an identity they had nothing to do with; these are
 * plain map identities now, unrelated to `view`/`comparison`/`isSitesChart` (Wave 4).
 */
export const MAP_TITLE_FORECAST = "FORECAST";
export const MAP_TITLE_DELTA = "DELTA";
export const MAP_TITLE_SOLAR_SITES = "SOLAR_SITES";
