import { ReactNode } from "react";

export enum ActiveUnit {
  MW = "MW",
  percentage = "%",
  capacity = "Capacity"
}

// GB-shaped shim, exactly like AGGREGATION_LEVELS in constant.ts: these four members are
// GB's four aggregation levels, which `deriveAggregationLevels` now produces from the
// registry (NL produces National/Province instead). Kept for its consumers; Phase 4 deletes
// it. `aggregationLevels.test.ts` asserts GB's derived labels still match these.
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
