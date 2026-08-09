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
