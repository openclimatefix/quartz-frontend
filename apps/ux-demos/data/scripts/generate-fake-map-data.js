const PV_MIN = 0;
const PV_MAX = 100;

const COORDINATES = [
  [-3.076171875, 55.658996099428364],
  [-2.515869140625, 54.7943516039205],
  [-0.9558105468749999, 54.25238930276849],
  [-2.373046875, 53.553362785528094],
  [-0.6042480468749999, 53.08082737207479],
  [-3.504638671875, 52.53627304145948],
  [0.406494140625, 52.38901106223458],
  [-2.13134765625, 51.72702815704774],
  [0.10986328125, 51.24128576954669],
  [-4.32861328125, 56.30434864830831],
  [-3.18603515625, 57.302789656350086],
  [-5.1416015625, 57.24339368551155],
];

const outputData = {
  type: "FeatureCollection",
  features: [],
};

for (let i = 0; i < 47; i++) {
  for (coord of COORDINATES) {
    const solarGeneration =
      i < 8 || i > 43 ? 0 : Math.floor(Math.random() * PV_MAX);

    outputData.features.push({
      type: "Feature",
      properties: {
        solarGeneration,
        timeStep: i,
      },
      geometry: {
        type: "Point",
        coordinates: coord,
      },
    });
  }
}

console.log(JSON.stringify(outputData));
