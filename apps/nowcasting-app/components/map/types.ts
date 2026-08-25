import { ReactNode } from "react";

export enum ActiveUnit {
  MW = "MW",
  percentage = "%",
  capacity = "Capacity",
  capacityDensity = "MW/km2"
}

export enum NationalAggregation {
  GSP = "GSP",
  zone = "Zone",
  DNO = "DNO",
  national = "National"
}

export enum SelectedData {
  expectedPowerGenerationNormalized = "expectedPowerGenerationNormalized",
  expectedPowerGenerationMegawatts = "expectedPowerGenerationMegawatts",
  expectedPowerGenerationMegawattsRounded = "expectedPowerGenerationMegawattsRounded",
  expectedPowerGenerationNormalizedRounded = "expectedPowerGenerationNormalizedRounded",
  actualPowerGenerationMegawatts = "actualPowerGenerationMegawatts",
  installedCapacityMw = "installedCapacityMw",
  capacityMwPerKm2 = "capacityMwPerKm2",
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
