export enum ActiveUnit {
  MW = "MW",
  percentage = "%",
}

export enum SelectedData {
  expectedPowerGenerationNormalized = "expectedPowerGenerationNormalized",
  expectedPowerGenerationMegawatts = "expectedPowerGenerationMegawatts",
}

export interface IMap {
  loadDataOverlay: any;
  controlOverlay: any;
  bearing?: number;
  updateData: { newData: boolean; updateMapData: (map: mapboxgl.Map) => void };
}
