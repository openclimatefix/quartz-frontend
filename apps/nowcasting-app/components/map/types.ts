export enum ActiveUnit {
  MW = "MW",
  percentage = "%",
  capacity = "Capacity"
}

export enum SelectedData {
  expectedPowerGenerationNormalized = "expectedPowerGenerationNormalized",
  expectedPowerGenerationMegawatts = "expectedPowerGenerationMegawatts",
  installedCapacityMw = "installedCapacityMw",
  delta = "delta"
}

export interface IMap {
  loadDataOverlay: any;
  controlOverlay: any;
  bearing?: number;
  updateData: { newData: boolean | string; updateMapData: (map: mapboxgl.Map) => void };
  children: React.ReactNode;
  title: string;
}
