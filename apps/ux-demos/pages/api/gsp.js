// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

// import gspValueData from "../../data/pv/pvlive-2021-06-10-GSP.json";
// import esoValueData from "../../data/pv/ngeso-2021-06-10.json";
import gspShapeData from "../../data/gsp-regions.json";

import pvlivedata20200807 from "../../data/2020-08-07/pvlive.json";
import pvlivedata20210305 from "../../data/2021-03-05/pvlive.json";
import pvlivedata20210309 from "../../data/2021-03-09/pvlive.json";
import pvlivedata20210610 from "../../data/2021-06-10/pvlive.json";
import pvlivedata20211008 from "../../data/2021-10-08/pvlive.json";

import ngesodata20200807 from "../../data/2020-08-07/ngeso.json";
import ngesodata20210305 from "../../data/2021-03-05/ngeso.json";
import ngesodata20210309 from "../../data/2021-03-09/ngeso.json";
import ngesodata20210610 from "../../data/2021-06-10/ngeso.json";
import ngesodata20211008 from "../../data/2021-10-08/ngeso.json";

export default function handler(req, res) {
  const { time, shape } = req.query;
  // console.log(Object.keys(gspValueData));
  console.log(time);
  console.log(shape);

  const pvliveDateLookup = {
    "2020-08-07": pvlivedata20200807,
    "2021-03-05": pvlivedata20210305,
    "2021-03-09": pvlivedata20210309,
    "2021-06-10": pvlivedata20210610,
    "2021-10-08": pvlivedata20211008,
  };
  const ngesoDateLookup = {
    "2020-08-07": ngesodata20200807,
    "2021-03-05": ngesodata20210305,
    "2021-03-09": ngesodata20210309,
    "2021-06-10": ngesodata20210610,
    "2021-10-08": ngesodata20211008,
  };

  // Parse time to date only (orig: 2021-03-09T12:00)
  const date = time.split("T")[0];
  const gspValueData = pvliveDateLookup[date];
  const esoValueData = ngesoDateLookup[date];

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
        const ocfDelta = ocfNGESOForecast - ocfPVLiveActual;

        return {
          type: "Feature",
          properties: {
            gspId: gspShape.properties.gsp_id,
            ocfTime: time,
            ocfPVLiveActual,
            ocfNGESOForecast,
            ocfDelta,
            ocfDeltaAbs: Math.abs(ocfDelta),
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
        ocfDeltaAbs: Math.abs(ocfNGESOForecast - ocfPVLiveActual),

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
