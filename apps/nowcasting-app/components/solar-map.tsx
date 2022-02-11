interface ISolarMap {
  gspregionData: GeoJsonObject;
  forecastData: object;
}

import { GeoJsonObject } from "geojson";
import { GeoJSON } from "react-leaflet";
import { LatLng, LeafletMouseEvent } from "leaflet";
import * as d3 from "d3";
import * as d3Geo from "d3-geo";
import {
  MapContainer,
  TileLayer,
  LayerGroup,
  useMapEvent,
} from "react-leaflet";

// const D3Layer = ({ geoShape, forecastData }) => {
//   const map = useMapEvent("zoom", () => {
//     reset();
//   });

//   const svg = d3.select(map.getPanes().overlayPane).append("svg");
//   const g = svg.append("g").attr("class", "leaflet-zoom-hide");

//   // Create a d3.geo.path to convert GeoJSON to SVG
//   var transform = d3Geo.geoTransform({
//     point: projectPoint,
//   });
//   var path = d3Geo.geoPath().projection(transform);
//   var features = g
//     .selectAll("path")
//     .data(geoShape.features)
//     .enter()
//     .append("path");

//   // fit the SVG element to leaflet's map layer
//   const reset = () => {
//     const bounds = path.bounds(geoShape);
//     const topLeft = bounds[0];
//     const bottomRight = bounds[1];

//     const width = bottomRight[0] - topLeft[0];
//     const height = bottomRight[1] - topLeft[1];

//     svg
//       .attr("width", width)
//       .attr("height", height)
//       .style("left", topLeft[0] + "px")
//       .style("top", topLeft[1] + "px");

//     g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

//     // initialize the path data
//     features
//       .attr("d", path)
//       .attr("class", "stroke-white")
//       .style("fill", function (d) {
//         return getForecastColorForGSP(d.properties.gsp_id);
//       });
//   };

//   reset();

//   // Use Leaflet to implement a D3 geometric transformation.
//   function projectPoint(x, y) {
//     var point = map.latLngToLayerPoint(new LatLng(y, x));
//     this.stream.point(point.x, point.y);
//   }

//   return null;
// };

const SolarMap = ({ gspregionData, forecastData }: ISolarMap) => {
  // GET THE COLORS FOR THE SHAPES
  const forecastAccessor = (d) =>
    d.forecastValues[0].expectedPowerGenerationMegawatts;
  const colorScale = d3
    .scaleQuantize()
    .domain(d3.extent(forecastData, forecastAccessor))
    .range([
      // '#FFF6DD',
      "#FFF0C8",
      // '#FFE59F',
      "#FFDA77",
      // '#FFCF4E',
      "#FFC425",
      // '#ECAC00',
      "#B48300",
      // '#7C5A00',
      "#443100",
    ]);
  console.log(d3.extent(forecastData, forecastAccessor));
  console.log(colorScale(2000));

  const getForecastColorForGSP = (id) => {
    forecastAccessor(forecastData[id]);
    return colorScale(forecastAccessor(forecastData[id]));
  };

  // other stuff

  const onEachGSP = (feature, layer) => {
    const {
      gsp_id,
      region_name: regionName,
      gsp_name: gspName,
    } = feature.properties;
    layer.on("mouseover", function (e: LeafletMouseEvent) {
      layer
        .bindPopup(
          `${regionName} (${gspName}) will produce ${forecastAccessor(
            forecastData[gsp_id]
          )}MW`
        )
        .openPopup();
    });
  };

  const styliseGSP = (feature) => {
    return {
      fillColor: getForecastColorForGSP(feature.properties.gsp_id),
      fillOpacity: 1,
      color: "white",
      weight: 1,
    };
  };

  return (
    <MapContainer
      center={[55.00366, -2.547855]}
      zoom={5.5}
      scrollWheelZoom={false}
      className="h-[52rem]"
    >
      {/* <LayerGroup>
        <D3Layer geoShape={gspregionData} forecastData={forecastData} />
      </LayerGroup> */}

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON
        data={gspregionData}
        onEachFeature={onEachGSP}
        style={styliseGSP}
      />
    </MapContainer>
  );
};

export default SolarMap;
