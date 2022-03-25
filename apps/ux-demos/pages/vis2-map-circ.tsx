import { NextPage } from "next";
import dynamic from "next/dynamic";
import { useState } from "react";
import DataAttribution from "../components/data-attribution";
import Layout from "../components/layout";
import Map from "../components/map";

import * as d3 from "d3";
import { useRouter } from "next/router";
import useSWR from "swr";

const SELECTED_SRC_VALUES = {
  ACTUAL: "ACTUAL",
  FORECAST: "FORECAST",
  DELTA: "DELTA",
  DELTA_ABS: "DELTA_ABS",
};

const Vis1MapPage: NextPage = () => {
  const INITIAL_TIME_STEP = 23;
  const [selectedTimeStep, setSelectedTimeStep] = useState(INITIAL_TIME_STEP);

  const [selectedSrc, setSelectedSrc] = useState(SELECTED_SRC_VALUES.ACTUAL);

  // Add support for dynamic data
  const router = useRouter();
  const date = router.query.date || "2021-06-10";
  console.log(date);

  //@ts-ignore
  const fetcher = (...args) => fetch(...args).then((res) => res.json());
  // http://localhost:3000/api/gsp?time=2021-06-10T12:00&shape=circ
  const { data: pvMapData, error } = useSWR(
    `/api/gsp?time=${date}T12:00&shape=circ`,
    fetcher
  );

  if (error) return <div>failed to load</div>;
  if (!pvMapData) return <div>loading...</div>;

  // Continue as normal below

  const timeSteps = [
    "00:30",
    "01:00",
    "01:30",
    "02:00",
    "02:30",
    "03:00",
    "03:30",
    "04:00",
    "04:30",
    "05:00",
    "05:30",
    "06:00",
    "06:30",
    "07:00",
    "07:30",
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
    "21:00",
    "21:30",
    "22:00",
    "22:30",
    "23:00",
    "23:30",
  ];

  const getVariableNameFromSelectedSrc = (selectedSrc) => {
    return {
      ACTUAL: "ocfPVLiveActual",
      FORECAST: "ocfNGESOForecast",
      DELTA: "ocfDelta",
      DELTA_ABS: "ocfDeltaAbs",
    }[selectedSrc];
  };

  const getAllDataValuesForSelectedSrc = (selectedSrc) => {
    return pvMapData.features.reduce((prev, cur) => {
      return [
        ...prev,
        cur.properties[getVariableNameFromSelectedSrc(selectedSrc)],
      ];
    }, []);
  };

  const getPaintPropsForFCActual = (selectedSrc) => {
    if (
      selectedSrc !== SELECTED_SRC_VALUES.ACTUAL &&
      selectedSrc !== SELECTED_SRC_VALUES.FORECAST
    ) {
      return;
    }

    const allActualValues = getAllDataValuesForSelectedSrc(
      SELECTED_SRC_VALUES.ACTUAL
    );
    const allFCValues = getAllDataValuesForSelectedSrc(
      SELECTED_SRC_VALUES.FORECAST
    );

    const extent = d3.extent([...allActualValues, ...allFCValues]);
    console.log(extent);
    return {
      "circle-color": "#eab308",
      "circle-opacity": [
        "interpolate",
        ["exponential", 1],
        ["get", getVariableNameFromSelectedSrc(selectedSrc)],
        0,
        0,
        1,
        0.1,
        extent[1],
        0.9,
      ],
      "circle-radius": [
        "interpolate",
        ["exponential", 1],
        ["get", getVariableNameFromSelectedSrc(selectedSrc)],
        0,
        0,
        1,
        20,
        extent[1],
        60,
      ],
    };
  };

  const filterBy = (map, timeStep) => {
    if (!map.current) return; // wait for map to initialize

    // const filters = ["==", "time", timeStep];
    // map.current.setFilter("pvgeneration-circles", filters);
    // setSelectedTimeStep(timeStep);
  };

  const addPVData = (map) => {
    map.current.addSource("pverrorbygsp", {
      type: "geojson",
      data: pvMapData,
    });

    map.current.addLayer({
      id: "pverrorbygsp-actual",
      type: "circle",
      source: "pverrorbygsp",
      layout: {
        // Make the layer visible by default.
        visibility: "visible",
      },
      paint: getPaintPropsForFCActual(SELECTED_SRC_VALUES.ACTUAL),
    });

    map.current.addLayer({
      id: "pverrorbygsp-forecast",
      type: "circle",
      source: "pverrorbygsp",
      layout: {
        // Hide the layer by default.
        visibility: "none",
      },
      paint: getPaintPropsForFCActual(SELECTED_SRC_VALUES.FORECAST),
    });

    map.current.addLayer({
      id: "pverrorbygsp-delta",
      type: "circle",
      source: "pverrorbygsp",
      layout: {
        // Hide the layer by default.
        visibility: "none",
        // "text-field": ["get", "ocfDelta"],
      },
      paint: {
        "circle-color": [
          "interpolate",
          ["linear"],
          ["get", "ocfDelta"],
          -0.00000000000001,
          "red",
          0,
          "#191a1a", // 0, ie transparent
          0.000000000000001,
          "green",
        ],
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "ocfDeltaAbs"],
          0,
          0,
          1,
          20,
          d3.max(getAllDataValuesForSelectedSrc(SELECTED_SRC_VALUES.DELTA_ABS)),
          60,
        ],
        "circle-opacity": 0.75,
      },
    });
    map.current.addLayer({
      id: "pverrorbygsp-delta-labels",
      type: "symbol",
      source: "pverrorbygsp",
      layout: {
        // Make the layer visible by default.
        visibility: "none",
        "text-field": ["get", "ocfDelta"],
        "text-variable-anchor": ["top", "bottom", "left", "right"],
        "text-radial-offset": 0,
        "text-justify": "auto",
      },
      paint: {
        "text-color": "white",
      },
      // paint: getPaintPropsForFCActual(SELECTED_SRC_VALUES.ACTUAL),
    });

    filterBy(map, INITIAL_TIME_STEP);
  };

  return (
    <Layout title="Various Solar Metrics by GSP">
      <DataAttribution
        datasets={[
          {
            title: "PV Generation",
            sourceName: "PV_Live, Sheffield Solar",
            sourceUrl: "https://www.solar.sheffield.ac.uk/pvlive/",
            displayedWhere: "Line Chart",
            isPublic: true,
          },
          {
            title: "PV Forecast",
            sourceName: "National Grid ESO",
            displayedWhere: "Line Chart",
            isPublic: false,
          },
          {
            title: "PV Generation by Site (Obfuscated)",
            sourceName: "Passiv",
            sourceUrl: "https://huggingface.co/datasets/openclimatefix/uk_pv",
            displayedWhere: "Map",
            isPublic: true,
          },
        ]}
      />
      <div className="flex flex-col h-full">
        <div className="flex-grow">
          <Map
            loadDataOverlay={addPVData}
            controlOverlay={(map) => {
              return (
                <>
                  <h2 className="font-bold">Solar Generation Data by Site</h2>
                  {/* <label id="timeStep"></label>
                  <input
                    id="slider"
                    type="range"
                    min="0"
                    max="46"
                    step="1"
                    value={selectedTimeStep}
                    className="w-full mt-3"
                    onChange={(e) => {
                      const timeStep = parseInt(e.target.value, 10);
                      filterBy(map, timeStep);
                    }}
                  /> */}
                  <div className="flex">
                    <div className="flex-grow">
                      Time: <span>{timeSteps[selectedTimeStep]}</span>
                    </div>
                    {/* <div className="">
                      <button
                        className="px-2 py-1 mr-1 border-2 border-white select-none hover:bg-white hover:text-black"
                        onClick={() => {
                          // Decrement timeStep or go back to max
                          if (selectedTimeStep === 0) {
                            return filterBy(map, timeSteps.length - 1);
                          }
                          filterBy(map, selectedTimeStep - 1);
                        }}
                      >
                        &lt;
                      </button>
                      <button
                        className="px-2 py-1 border-2 border-white select-none hover:bg-white hover:text-black"
                        onClick={() => {
                          // Incrememnt timeStep or go back to 0
                          if (selectedTimeStep === timeSteps.length - 1) {
                            return filterBy(map, 0);
                          }
                          filterBy(map, selectedTimeStep + 1);
                        }}
                      >
                        &gt;
                      </button>
                    </div> */}
                  </div>
                  {/* <div className="pt-4 pb-2 my-2 border-white border-y">
                    <div className="h-3 mb-2 bg-gradient-to-r from-transparent to-yellow-500"></div>
                  </div> */}
                  <div className="flex gap-2 mt-4">
                    <button
                      className={`px-2 py-1 border-2 border-white select-none hover:bg-white hover:text-black ${
                        selectedSrc === SELECTED_SRC_VALUES.ACTUAL &&
                        "bg-white text-black"
                      }`}
                      onClick={() => {
                        // SHOW FORECAST ONLY
                        setSelectedSrc(SELECTED_SRC_VALUES.ACTUAL);
                        map.current.setLayoutProperty(
                          "pverrorbygsp-actual",
                          "visibility",
                          "visible"
                        );

                        // HIDE OTHER TWO
                        map.current.setLayoutProperty(
                          "pverrorbygsp-forecast",
                          "visibility",
                          "none"
                        );
                        map.current.setLayoutProperty(
                          "pverrorbygsp-delta",
                          "visibility",
                          "none"
                        );
                        map.current.setLayoutProperty(
                          "pverrorbygsp-delta-labels",
                          "visibility",
                          "none"
                        );
                      }}
                    >
                      Actual (pvLive)
                    </button>
                    <button
                      className={`px-2 py-1 border-2 hover:bg-white hover:text-black border-white select-none ${
                        selectedSrc === SELECTED_SRC_VALUES.FORECAST &&
                        "bg-white text-black"
                      }`}
                      onClick={() => {
                        // SHOW FORECAST ONLY
                        setSelectedSrc(SELECTED_SRC_VALUES.FORECAST);
                        map.current.setLayoutProperty(
                          "pverrorbygsp-forecast",
                          "visibility",
                          "visible"
                        );

                        // HIDE OTHER TWO
                        map.current.setLayoutProperty(
                          "pverrorbygsp-actual",
                          "visibility",
                          "none"
                        );
                        map.current.setLayoutProperty(
                          "pverrorbygsp-delta",
                          "visibility",
                          "none"
                        );
                        map.current.setLayoutProperty(
                          "pverrorbygsp-delta-labels",
                          "visibility",
                          "none"
                        );
                      }}
                    >
                      Forecast (NG-ESO)
                    </button>
                    <button
                      className={`px-2 py-1 border-2 hover:bg-white hover:text-black border-white select-none ${
                        selectedSrc === SELECTED_SRC_VALUES.DELTA &&
                        "bg-white text-black"
                      }`}
                      onClick={() => {
                        // SHOW DELTA ONLY
                        setSelectedSrc(SELECTED_SRC_VALUES.DELTA);
                        map.current.setLayoutProperty(
                          "pverrorbygsp-delta",
                          "visibility",
                          "visible"
                        );
                        map.current.setLayoutProperty(
                          "pverrorbygsp-delta-labels",
                          "visibility",
                          "visible"
                        );

                        // HIDE OTHER TWO
                        map.current.setLayoutProperty(
                          "pverrorbygsp-actual",
                          "visibility",
                          "none"
                        );
                        map.current.setLayoutProperty(
                          "pverrorbygsp-forecast",
                          "visibility",
                          "none"
                        );
                      }}
                    >
                      Delta
                    </button>
                  </div>
                </>
              );
            }}
          />
        </div>
        {/* <div className="border-t border-black h-60">
          <MyResponsiveLine
            // TODO: replace with real pv forecast
            timeOfInterest={timeSteps[selectedTimeStep]}
            data={[
              {
                // PV_GSP_ASL_20210610002152
                // 14010326
                id: "Forecast (NG-ESO)",
                color: "black",
                data: [
                  { x: "00:30", y: 0 },
                  { x: "01:00", y: 0 },
                  { x: "01:30", y: 0 },
                  { x: "02:00", y: 0 },
                  { x: "02:30", y: 0 },
                  { x: "03:00", y: 0 },
                  { x: "03:30", y: 0 },
                  { x: "04:00", y: 0 },
                  { x: "04:30", y: 0 },
                  { x: "05:00", y: 365.44 },
                  { x: "05:30", y: 618.4 },
                  { x: "06:00", y: 933.12 },
                  { x: "06:30", y: 1169.51 },
                  { x: "07:00", y: 1677.84 },
                  { x: "07:30", y: 2484.21 },
                  { x: "08:00", y: 3112.8 },
                  { x: "08:30", y: 3686.4 },
                  { x: "09:00", y: 4272.83 },
                  { x: "09:30", y: 4840.79 },
                  { x: "10:00", y: 5272.84 },
                  { x: "10:30", y: 5643.19 },
                  { x: "11:00", y: 5832.48 },
                  { x: "11:30", y: 5765.5 },
                  { x: "12:00", y: 5746.54 },
                  { x: "12:30", y: 5810.25 },
                  { x: "13:00", y: 5640.4 },
                  { x: "13:30", y: 5144.3 },
                  { x: "14:00", y: 4914.74 },
                  { x: "14:30", y: 4870.64 },
                  { x: "15:00", y: 4595.41 },
                  { x: "15:30", y: 4314.91 },
                  { x: "16:00", y: 3855.1 },
                  { x: "16:30", y: 3448.35 },
                  { x: "17:00", y: 2766.6 },
                  { x: "17:30", y: 1430.14 },
                  { x: "18:00", y: 836.33 },
                  { x: "18:30", y: 816.89 },
                  { x: "19:00", y: 500.42 },
                  { x: "19:30", y: 171.54 },
                  { x: "20:00", y: 33.89 },
                  { x: "20:30", y: 13.53 },
                  { x: "21:00", y: 3.06 },
                  { x: "21:30", y: 0.04 },
                  { x: "22:00", y: 0 },
                  { x: "22:30", y: 0 },
                  { x: "23:00", y: 0 },
                  { x: "23:30", y: 0 },
                ],
              },
              pvLiveGenerationData,
            ]}
          /> 
        </div>*/}
      </div>
    </Layout>
  );
};

export default Vis1MapPage;
