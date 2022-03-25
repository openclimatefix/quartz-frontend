# UX-Demos Data

These are the days we consider "interesting":

```js
const DATES_OF_INTEREST = [
  "2021-10-08",
  "2021-03-09",
  "2021-03-05",
  "2020-08-07",
  "2021-06-10",
]; // YYYY-MM-DD
```

For each of these days, there is a respective folder in this `data` directory.
Each of these folders contains the following files:

## `generation-forecast.json`

Contains solar electricity generation (via pvlive) and the forecast for that day (via NG-ESO).
Used by the `LineChart` found in `vis1-map` and `vis1-line-only`.

**Sample:**

```json
[{ "time": "03:30", "FORECAST": 1, "GENERATION": 0.000266 }]
```

## `generation-mix.json`

Contains the full electricity generation mix (via Elexon), the demand (via Elexon) as well as solar generation (via pvlive) and the solar forecast (via NG-ESO).
Used by the `BarChart` found in `vis3-bar`.

**Sample:**

```json
[
  {
    "time": "00:00",
    "Combined Cycle Gas Turbines": 5376,
    "Oil": 0,
    "Coal": 0,
    "Nuclear": 5778,
    "Wind": 4752,
    "Pumped Storage": 0,
    "Hydro": 48,
    "Open Cycle Gas Turbines": 3,
    "Biomass": 2557,
    "Other": 140,
    "INTFR": 1188,
    "INTIRL": 220,
    "INTED": 694,
    "INTEW": 106,
    "INTNEM": 686,
    "SOLAR": 0,
    "DEMAND": 22229,
    "FORECAST": 21548
  }
]
```

## `generation-passiv.json`

GeoJSON file containing solar electricity generation by site (via Passiv) over a full day
Used by the `Map` found in `vis1-map`.

**Sample:**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-2.836308, 53.360567]
      },
      "properties": {
        "solarGeneration": 0,
        "time": 7,
        "systemId": 10003
      }
    }
  ]
}
```

## `ngeso.json`

Solar Electricity forecast over the course of a day, by GSP (via NG-ESO).
Used by the `Map` found in `vis2-map-poly` and `vis2-map-circ`.

**Sample:**

```json
{
  "2021-10-08T03:30": {
    "ABHA1": 0,
    "ABNE_P": 0,
    "ABTH_1": 0,
    "ACTL_2": 0,
    "ACTL_C": 0,
    "ALNE_P": 0,
    "ALST_3": 0,
    "ALVE1": 0,
    "AMEM_1": 0,
    "ARBR_P": 1,
    "ARDK_P": null,
    "ARMO_P": 0,
    "AXMI1": 0,
    "AYRR": 0,
    "BAGA": 0,
    "BAIN": 0,
    "BARKC1": 0,
    "BARKW3": 0,
    "BEAU_P": 0,
    "BEDDT1": 0,
    "BEDD_1": 0,
    "BERW": 0,
    "BESW_1": 0,
    "BICF_1": 0
    // ...
  }
}
```

## `pvlive.json`

Solar Electricity generation over the course of a day, by GSP (via PVLIve).
Used by the `Map` found in `vis2-map-poly` and `vis2-map-circ`.

**Sample:**

```json
{
  "2021-10-08T04:00": {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
    "7": 0,
    "8": 0,
    "9": 0,
    "10": 0,
    "11": 0,
    "12": 0,
    "13": 0,
    "14": 0,
    "15": 0,
    "16": 0,
    "17": 0,
    "18": 0,
    "19": 0,
    "20": 0,
    "21": 0,
    "22": 0
    // ...
  }
}
```

> Note: As of 2021-03-25, only the folder `2021-10-08` contains real data.
> ALL OTHER FOLDER CONTAIN FAKED DATA.

More information: https://docs.google.com/document/d/1nFEa1hKBlLKyw69iapbl9F1ifUYBRGfnF8HtCs_oCUY/edit
