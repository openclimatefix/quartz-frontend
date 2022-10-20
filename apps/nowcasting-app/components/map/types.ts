export enum ActiveUnit {
  MW = "MW",
  percentage = "%",
  capacity = "Capacity"
}

export enum SelectedData {
  expectedPowerGenerationNormalized = "expectedPowerGenerationNormalized",
  expectedPowerGenerationMegawatts = "expectedPowerGenerationMegawatts",
  installedCapacityMw = "installedCapacityMw"
}

export interface IMap {
  loadDataOverlay: any;
  controlOverlay: any;
  bearing?: number;
  updateData: { newData: boolean; updateMapData: (map: mapboxgl.Map) => void };
}
