// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import gspValueData from "../../data/pv/pvlive-2021-06-10-GSP.json";
import esoValueData from "../../data/pv/ngeso-2021-06-10.json";
import gspShapeData from "../../data/gsp-regions.json";

export default function handler(req, res) {
  const { time, shape } = req.query;
  console.log(Object.keys(gspValueData));
  console.log(time);
  console.log(shape);

  if (!Object.keys(gspValueData).includes(time)) {
    return res
      .status(404)
      .json({ msg: `Time ${time || "NO_TIME_SUPPLIED"} not found in data` });
  }

  // res.status(200).json({
  //   pvlive: gspValueData[time],
  //   ngeso: esoValueData[time],
  // });

  const pvliveDataSelected = gspValueData[time];
  const ngesoDataSelected = esoValueData[time];

  if (shape === "circ") {
    return res.status(200).json({
      type: "FeatureCollection",
      features: gspShapeData.features.map((gspShape) => {
        const ocfPVLiveActual = pvliveDataSelected[gspShape.properties.gsp_id];
        const ocfNGESOForecast =
          ngesoDataSelected[gspShape.properties.gsp_name];
        return {
          type: "Feature",
          properties: {
            gspId: gspShape.properties.gsp_id,
            ocfTime: time,
            ocfPVLiveActual,
            ocfNGESOForecast,
            ocfDelta: ocfNGESOForecast - ocfPVLiveActual,
          },
          geometry: {
            type: "Point",
            coordinates: [
              gspShape.properties.centroid_lon,
              gspShape.properties.centroid_lat,
            ],
          },
        };
      }),
    });
  }

  const gspShapesWithData = gspShapeData.features.map((gspShape) => {
    const ocfPVLiveActual = pvliveDataSelected[gspShape.properties.gsp_id];
    const ocfNGESOForecast = ngesoDataSelected[gspShape.properties.gsp_name];
    return {
      ...gspShape,
      properties: {
        // ...gspShape.properties,
        gspId: gspShape.properties.gsp_id,
        ocfTime: time,
        ocfPVLiveActual,
        ocfNGESOForecast,
        ocfDelta: ocfNGESOForecast - ocfPVLiveActual,

        centroidLat: gspShape.properties.centroid_lat,
        centroidLon: gspShape.properties.centroid_lon,
      },
    };
  });

  res.status(200).json({
    type: "FeatureCollection",
    features: gspShapesWithData,
  });
}
