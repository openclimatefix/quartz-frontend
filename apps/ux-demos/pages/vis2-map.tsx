import { NextPage } from "next";
import DataAttribution from "../components/data-attribution";
import Layout from "../components/layout";
import Map from "../components/map";

const badGeojson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        pverror: 1000,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-2.30712890625, 53.79740645735382],
            [-3.05419921875, 52.86581372042818],
            [-1.1590576171875, 52.308478623663355],
            [0.2691650390625, 53.05442186546102],
            [-1.351318359375, 54.236340214413424],
            [-2.30712890625, 53.79740645735382],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        pverror: 500,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-2.0819091796875, 52.76621560598258],
            [-2.2412109375, 51.964577109947506],
            [-0.9667968749999999, 51.13110763758015],
            [0.5218505859375, 52.274880130680536],
            [-0.9722900390624999, 52.01869808104436],
            [-1.69189453125, 52.65972593335803],
            [-2.0819091796875, 52.76621560598258],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        pverror: 100,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-3.153076171875, 55.47885346331034],
            [-4.350585937499999, 54.49556752187406],
            [-3.614501953125, 54.13669645687002],
            [-0.252685546875, 55.141209644495056],
            [-2.142333984375, 54.85131525968606],
            [-1.23046875, 55.31664304437719],
            [-2.26318359375, 55.17259379606185],
            [-2.48291015625, 55.485079037526134],
            [-3.153076171875, 55.47885346331034],
          ],
        ],
      },
    },
  ],
};

const Vis2MapPage: NextPage = () => {
  const addPolygonData = (map) => {
    map.current.addSource("pverrorbygsp", {
      type: "geojson",
      data: badGeojson,
    });

    map.current.addLayer({
      id: "pverrorbygsp-circles",
      type: "fill",
      source: "pverrorbygsp",
      layout: {},
      paint: {
        "fill-color": [
          "interpolate",
          ["linear"],
          ["get", "pverror"],
          100,
          "#eab308",
          1000,
          "#ef4444",
        ],
        "fill-opacity": 0.5,
      },
    });
  };

  return (
    <>
      <Layout title="Biggest Forecast Error by GSP">
        <DataAttribution
          datasets={[
            {
              title: "PV Generation (GSP)",
              sourceName: "PV_Live, Sheffield Solar",
              sourceUrl: "https://www.solar.sheffield.ac.uk/pvlive/",
              displayedWhere: "Map",
              isPublic: true,
            },
            {
              title: "PV Forecast (GSP)",
              sourceName: "National Grid ESO",
              displayedWhere: "Map",
              isPublic: false,
            },
          ]}
        />
        <div className="h-full">
          <Map
            loadDataOverlay={addPolygonData}
            controlOverlay={() => (
              <>
                <h2 className="font-bold">Biggest Forecast Error by GSP</h2>
                <p>Shaded by delta of forecast less actual generation.</p>
                <div className="pt-4 my-2 border-t border-white">
                  <div className="flex justify-between px-2 mb-2 bg-red-200 bg-gradient-to-r from-yellow-500 to-red-500">
                    <div>small</div>
                    <div>big</div>
                  </div>
                </div>
              </>
            )}
          />
        </div>
      </Layout>
    </>
  );
};

export default Vis2MapPage;
