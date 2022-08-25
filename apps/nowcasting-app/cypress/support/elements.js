const elements = {
  map: ".mapboxgl-canvas",
  NFChart: "[data-e2e=NF-chart]",
  NFHeader: "[data-e2e=NF-header]",
  GSPFChart: "[data-e2e=GSPF-chart]",
  GSPFHeader: "[data-e2e=GSPF-header]",
  mapLoaded: "[data-e2e=map-loaded]",
  percentageBtn: "[data-e2e=percentage-button]",
  MWBtn: "[data-e2e=MW-button]",
  pauseButton: "[data-e2e=pause-button]",
  playButton: "[data-e2e=play-button]",
  mapTime: "[data-e2e=map-time]",
  gspTimeReference: "[data-e2e=gsp-reference]",
  headerMapTime: "[data-e2e=header-map-time]",
  resetTimeButton: "[data-e2e=national-now-refrence]",
};
elements.NFActualPv = elements.NFHeader + " [data-e2e=actual-pv]";
elements.NFSelectedForecastPv = elements.NFHeader + " [data-e2e=selected-forecast-pv]";
elements.NFNextForecastPv = elements.NFHeader + " [data-e2e=next-forecast-pv]";
elements.GSPFTitle = elements.GSPFHeader + " [data-e2e=title]";
elements.GSPFPvValues = elements.GSPFHeader + " [data-e2e=pv-values]";
elements.GSPFCloseBtn = elements.GSPFChart + " [data-e2e=close-button]";

export default elements;
