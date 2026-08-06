import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { Feature } from "geojson";

import { generateGeoJsonForecastData } from "./data";
import { CombinedData, GspDeltaValue } from "../types";
import { NationalAggregation, SelectedData } from "../map/types";
import { components } from "../../types/quartz-api";

import dnoGspGroupings from "../../data/dno_gsp_groupings.json";
import ngGspZoneGroupings from "../../data/ng_gsp_zone_groupings.json";
import nationalGspZone from "../../data/national_gsp_zone.json";
import allGspActualHistoricCompact from "../../data/updatedDummyApiResponses/allGspActualHistoricCompact.json";
import allGspForecastHistoricalDataCompact from "../../data/updatedDummyApiResponses/allGspForecastHistoricCompact.json";
import fcAll from "../../data/dummy-res/fc-all.json";

//////////////////////////////////////////////////////////////////////////////
// Characterisation tests for the map's geo aggregation.
//
// These pin CURRENT behaviour ahead of the v1 / multi-country migration, which
// moves region identity from numeric `gspId` to `regionName` and turns the
// DNO / NG-zone rollups into per-country config. Anything marked
// CHARACTERISATION is a defect that is deliberately preserved here so that the
// migration is a visible, deliberate change rather than a silent one.
//
// Numbers in the aggregation tests are hand-computable: each member GSP of a
// grouping is given a value of exactly 1 MW (or its own id), so the expected
// total is the group's size (or the arithmetic sum of its ids).
//////////////////////////////////////////////////////////////////////////////

// A GSP name that appears exactly once in data/GSP_regions_4326_20250109.json.
const GSP_NAME = "CHAP";
const GSP_ID = 5;
const TARGET_TIME = "2023-12-05T12:00:00+00:00";

type Location = components["schemas"]["Location"];
type ForecastRow = components["schemas"]["OneDatetimeManyForecastValues"];
type YieldRow = components["schemas"]["GSPYieldGroupByDatetime"];

const makeLocation = (over: Partial<Location> = {}): Location =>
  ({
    label: "GSP",
    gspId: GSP_ID,
    gspName: GSP_NAME,
    gspGroup: "_N",
    regionName: "Chapelcross",
    installedCapacityMw: 200,
    rmMode: true,
    ...over
  } as Location);

const makeCombinedData = (
  allGspSystemData: Location[],
  allGspRealData: YieldRow[] = []
): CombinedData =>
  ({
    allGspSystemData,
    allGspRealData
  } as unknown as CombinedData);

const featureFor = (features: Feature[], gspName: string) =>
  features.find((f) => f.properties?.GSPs === gspName);

const featureById = (features: Feature[], id: string) =>
  features.find((f) => f.properties?.id === id);

/////////////////////////////////
// GSP level — pass-through    //
/////////////////////////////////
describe("generateGeoJsonForecastData — GSP level", () => {
  const forecastData: ForecastRow[] = [
    { datetimeUtc: TARGET_TIME, forecastValues: { [GSP_ID]: 150, 999: 42 } }
  ];
  const realData: YieldRow[] = [
    { datetimeUtc: TARGET_TIME, generationKwByGspId: { [GSP_ID]: "120000" } } as YieldRow
  ];

  test("returns a FeatureCollection with one feature per GSP polygon, unfiltered", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      forecastData,
      TARGET_TIME,
      makeCombinedData([makeLocation()], realData)
    );

    expect(forecastGeoJson.type).toBe("FeatureCollection");
    // The whole GB GSP boundary file is returned regardless of how much data
    // arrived — 349 polygons over 333 distinct GSP names.
    expect(forecastGeoJson.features).toHaveLength(349);
    expect(new Set(forecastGeoJson.features.map((f) => f.properties?.GSPs)).size).toBe(333);
  });

  test("a matched GSP carries the forecast, actuals, capacity and display name", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      forecastData,
      TARGET_TIME,
      makeCombinedData([makeLocation()], realData)
    );
    const feature = featureFor(forecastGeoJson.features, GSP_NAME);
    const props = feature?.properties as Record<string, unknown>;

    expect(props.id).toBe(GSP_ID);
    expect(props.GSPs).toBe(GSP_NAME);
    expect(props.gspDisplayName).toBe("Chapelcross");
    // 150 MW forecast, rounding factor 100 -> 150 raw, 200 rounded.
    expect(props[SelectedData.expectedPowerGenerationMegawatts]).toBe(150);
    expect(props[SelectedData.expectedPowerGenerationMegawattsRounded]).toBe(200);
    // 150 / 200 MW capacity = 0.75 normalised; the rounded form is an opacity step.
    expect(props[SelectedData.expectedPowerGenerationNormalized]).toBe(0.75);
    expect(props[SelectedData.expectedPowerGenerationNormalizedRounded]).toBe(1);
    // 120000 kW -> 120 MW.
    expect(props[SelectedData.actualPowerGenerationMegawatts]).toBe(120);
    expect(props[SelectedData.installedCapacityMw]).toBe(200);
  });

  test("the geometry is passed through untouched", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      forecastData,
      TARGET_TIME,
      makeCombinedData([makeLocation()], realData)
    );
    const feature = featureFor(forecastGeoJson.features, GSP_NAME);
    expect(feature?.type).toBe("Feature");
    expect(feature?.geometry).toBeDefined();
    expect(["Polygon", "MultiPolygon"]).toContain(feature?.geometry?.type);
  });

  test("no feature ends up with an undefined property key", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      forecastData,
      TARGET_TIME,
      makeCombinedData([makeLocation()], realData)
    );
    for (const feature of forecastGeoJson.features) {
      expect(Object.keys(feature.properties || {})).not.toContain("undefined");
    }
  });

  test("the join is on gspName === feature.properties.GSPs, and is case sensitive", () => {
    // The migration intends a case-insensitive match; today a case mismatch is
    // simply a miss.
    const { forecastGeoJson } = generateGeoJsonForecastData(
      forecastData,
      TARGET_TIME,
      makeCombinedData([makeLocation({ gspName: GSP_NAME.toLowerCase() })], realData)
    );
    const props = featureFor(forecastGeoJson.features, GSP_NAME)?.properties as Record<
      string,
      unknown
    >;

    // CHARACTERISATION: current behaviour is wrong — "chap" should match the
    // "CHAP" polygon; instead the region silently falls back to the id-1000
    // placeholder and renders with no data.
    expect(props.id).toBe(1000);
    expect(props.gspDisplayName).toBe("");
    expect(props[SelectedData.installedCapacityMw]).toBe(0);
  });

  test("a GSP with no matching system data falls back to the magic id 1000", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      forecastData,
      TARGET_TIME,
      makeCombinedData([makeLocation()], realData)
    );
    const props = featureFor(forecastGeoJson.features, "NETS")?.properties as Record<
      string,
      unknown
    >;

    // CHARACTERISATION: current behaviour is wrong — every unmatched polygon
    // collapses onto the same sentinel id 1000, so they are indistinguishable
    // from each other and would collide with a real GSP 1000.
    expect(props.id).toBe(1000);
    expect(props.gspDisplayName).toBe("");
  });

  test("a GSP with no matching actuals gets NaN, not 0 or undefined", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      forecastData,
      TARGET_TIME,
      makeCombinedData([makeLocation()], realData)
    );
    const props = featureFor(forecastGeoJson.features, "NETS")?.properties as Record<
      string,
      unknown
    >;

    // CHARACTERISATION: current behaviour is wrong — Number(undefined) / 1000
    // produces NaN, which leaks into the map paint properties. Missing actuals
    // should be undefined/null and render as "no data".
    expect(props[SelectedData.actualPowerGenerationMegawatts]).toBeNaN();
  });

  test("system data for a region with no polygon is silently dropped", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      forecastData,
      TARGET_TIME,
      makeCombinedData([makeLocation({ gspName: "NOT_A_REAL_GSP", gspId: 4242 })], realData)
    );
    expect(forecastGeoJson.features).toHaveLength(349);
    expect(featureById(forecastGeoJson.features, "4242")).toBeUndefined();
    expect(forecastGeoJson.features.some((f) => f.properties?.id === 4242)).toBe(false);
  });

  test("targetTime is matched on the minute — seconds and offset are ignored", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [{ datetimeUtc: "2023-12-05T12:00:00+00:00", forecastValues: { [GSP_ID]: 150 } }],
      // Same minute, different seconds/offset representation.
      "2023-12-05T12:00:59.999Z",
      makeCombinedData([makeLocation()], realData)
    );
    const props = featureFor(forecastGeoJson.features, GSP_NAME)?.properties as Record<
      string,
      unknown
    >;
    expect(props[SelectedData.expectedPowerGenerationMegawatts]).toBe(150);
  });

  test("a timestamp that is present but off by 30 minutes does not match", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      forecastData,
      "2023-12-05T12:30:00+00:00",
      makeCombinedData([makeLocation()], realData)
    );
    const props = featureFor(forecastGeoJson.features, GSP_NAME)?.properties as Record<
      string,
      unknown
    >;
    expect(props[SelectedData.expectedPowerGenerationMegawatts]).toBe(undefined);
    expect(props[SelectedData.actualPowerGenerationMegawatts]).toBeNaN();
  });
});

/////////////////////////////////////////
// GSP level — empty / null generation //
/////////////////////////////////////////
describe("generateGeoJsonForecastData — empty and null inputs at GSP level", () => {
  test("no arguments at all still returns the full untouched polygon set", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData();
    expect(forecastGeoJson.type).toBe("FeatureCollection");
    expect(forecastGeoJson.features).toHaveLength(349);
    for (const feature of forecastGeoJson.features) {
      expect(feature.properties?.id).toBe(1000);
      expect(feature.properties?.gspDisplayName).toBe("");
      expect(feature.properties?.[SelectedData.installedCapacityMw]).toBe(0);
    }
  });

  test("empty forecast and empty system data leave every value blank or NaN", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [],
      TARGET_TIME,
      makeCombinedData([], [])
    );
    const props = featureFor(forecastGeoJson.features, GSP_NAME)?.properties as Record<
      string,
      unknown
    >;
    expect(props[SelectedData.expectedPowerGenerationMegawatts]).toBe(undefined);
    expect(props[SelectedData.actualPowerGenerationMegawatts]).toBeNaN();
  });

  test("a forecast value of exactly 0 is written through as 0, not rounded", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [{ datetimeUtc: TARGET_TIME, forecastValues: { [GSP_ID]: 0 } }],
      TARGET_TIME,
      makeCombinedData(
        [makeLocation()],
        [{ datetimeUtc: TARGET_TIME, generationKwByGspId: { [GSP_ID]: "0" } } as YieldRow]
      )
    );
    const props = featureFor(forecastGeoJson.features, GSP_NAME)?.properties as Record<
      string,
      unknown
    >;
    // CHARACTERISATION: current behaviour is wrong — the `value && f(value)`
    // idiom short-circuits on a legitimate zero, so 0 MW bypasses the rounding
    // and normalising that every other value goes through.
    expect(props[SelectedData.expectedPowerGenerationMegawatts]).toBe(0);
    expect(props[SelectedData.expectedPowerGenerationNormalized]).toBe(0);
    expect(props[SelectedData.actualPowerGenerationMegawatts]).toBe(0);
  });

  test("a null forecast value is written through as null", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [
        {
          datetimeUtc: TARGET_TIME,
          forecastValues: { [GSP_ID]: null as unknown as number }
        }
      ],
      TARGET_TIME,
      makeCombinedData([makeLocation()], [])
    );
    const props = featureFor(forecastGeoJson.features, GSP_NAME)?.properties as Record<
      string,
      unknown
    >;
    // CHARACTERISATION: current behaviour is wrong — null reaches the map paint
    // properties verbatim rather than being normalised to a missing value.
    expect(props[SelectedData.expectedPowerGenerationMegawatts]).toBe(null);
  });

  test("a non-numeric generation string becomes NaN", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [{ datetimeUtc: TARGET_TIME, forecastValues: { [GSP_ID]: 10 } }],
      TARGET_TIME,
      makeCombinedData(
        [makeLocation()],
        [
          {
            datetimeUtc: TARGET_TIME,
            generationKwByGspId: { [GSP_ID]: "not-a-number" }
          } as YieldRow
        ]
      )
    );
    const props = featureFor(forecastGeoJson.features, GSP_NAME)?.properties as Record<
      string,
      unknown
    >;
    // CHARACTERISATION: current behaviour is wrong — an unparseable value is
    // indistinguishable from a missing one and both paint as NaN.
    expect(props[SelectedData.actualPowerGenerationMegawatts]).toBeNaN();
  });

  test("missing installed capacity divides by 1 rather than producing Infinity", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [{ datetimeUtc: TARGET_TIME, forecastValues: { [GSP_ID]: 10 } }],
      TARGET_TIME,
      makeCombinedData([makeLocation({ installedCapacityMw: undefined })], [])
    );
    const props = featureFor(forecastGeoJson.features, GSP_NAME)?.properties as Record<
      string,
      unknown
    >;
    // 10 / 1 = 10 — a "normalised" value ten times its own ceiling.
    expect(props[SelectedData.expectedPowerGenerationNormalized]).toBe(10);
    expect(props[SelectedData.installedCapacityMw]).toBe(0);
  });
});

///////////////////////////
// GSP level — deltas    //
///////////////////////////
describe("generateGeoJsonForecastData — delta overlay at GSP level", () => {
  const deltas = new Map<string, GspDeltaValue>([
    [String(GSP_ID), { delta: -60, deltaNormalized: "-0.3", deltaBucket: -50 } as GspDeltaValue]
  ]);

  test("delta values overwrite the forecast properties when a delta map is supplied", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [{ datetimeUtc: TARGET_TIME, forecastValues: { [GSP_ID]: 150 } }],
      TARGET_TIME,
      makeCombinedData([makeLocation()], []),
      deltas
    );
    const props = featureFor(forecastGeoJson.features, GSP_NAME)?.properties as Record<
      string,
      unknown
    >;

    expect(props[SelectedData.delta]).toBe(-60);
    expect(props.deltaBucket).toBe(-50);
    // The forecast properties are clobbered by the delta rather than kept
    // alongside it — the map reuses the same paint keys for both views.
    expect(props[SelectedData.expectedPowerGenerationMegawatts]).toBe(-60);
    expect(props[SelectedData.expectedPowerGenerationNormalized]).toBe(-0.3);
  });

  test("the delta map is keyed by the stringified gsp id, so unmatched regions get 0", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [{ datetimeUtc: TARGET_TIME, forecastValues: { [GSP_ID]: 150 } }],
      TARGET_TIME,
      makeCombinedData([makeLocation()], []),
      deltas
    );
    const props = featureFor(forecastGeoJson.features, "NETS")?.properties as Record<
      string,
      unknown
    >;
    // CHARACTERISATION: current behaviour is wrong — a region with no delta is
    // painted as "exactly on forecast" rather than as having no data.
    expect(props[SelectedData.delta]).toBe(0);
    expect(props.deltaBucket).toBe(0);
  });
});

///////////////////////////////////////
// Grouping files — join invariants   //
///////////////////////////////////////
describe("grouping files line up with their boundary files", () => {
  test("every DNO grouping key is a LongName in the DNO boundary file, and vice versa", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [],
      TARGET_TIME,
      makeCombinedData([], []),
      undefined,
      NationalAggregation.DNO
    );
    const longNames = forecastGeoJson.features.map((f) => f.properties?.LongName);
    expect(longNames).toHaveLength(14);
    expect(new Set(longNames)).toEqual(new Set(Object.keys(dnoGspGroupings)));
  });

  test("every NG-zone grouping key is an id in the zone boundary file, and vice versa", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [],
      TARGET_TIME,
      makeCombinedData([], []),
      undefined,
      NationalAggregation.zone
    );
    const ids = forecastGeoJson.features.map((f) => f.properties?.id);
    expect(ids).toHaveLength(19);
    expect(new Set(ids)).toEqual(new Set(Object.keys(ngGspZoneGroupings)));
  });

  test("the groupings are keyed by numeric gsp id, which is what the migration replaces", () => {
    // Pinned so that regenerating the grouping files name-keyed is a visible,
    // test-breaking change rather than a silent one.
    for (const ids of Object.values(dnoGspGroupings)) {
      for (const id of ids) expect(typeof id).toBe("number");
    }
    for (const ids of Object.values(ngGspZoneGroupings)) {
      for (const id of ids) expect(typeof id).toBe("number");
    }
    expect(Object.keys(nationalGspZone)).toEqual(["National"]);
    expect(nationalGspZone.National).toHaveLength(317);
  });
});

/////////////////////////////
// DNO / zone aggregation  //
/////////////////////////////
const ENWL_GSP_IDS: number[] = dnoGspGroupings.ENWL;
const NW_SCOTLAND_GSP_IDS: number[] = (ngGspZoneGroupings as Record<string, number[]>)[
  "NW Scotland"
];

describe("generateGeoJsonForecastData — DNO aggregation", () => {
  // 17 member GSPs. Give each exactly 1 MW of forecast, 2 MW (2000 kW) of
  // actuals and 10 MW of capacity, so the expected totals are 17, 34 and 170.
  const forecastValues: Record<string, number> = {};
  const generationKwByGspId: Record<string, string> = {};
  const systemData: Location[] = [];
  for (const id of ENWL_GSP_IDS) {
    forecastValues[String(id)] = 1;
    generationKwByGspId[String(id)] = "2000";
    systemData.push(makeLocation({ gspId: id, gspName: `GSP_${id}`, installedCapacityMw: 10 }));
  }
  // A GSP that belongs to a different DNO, to prove the rollup is selective.
  forecastValues["9999"] = 1000;
  generationKwByGspId["9999"] = "9999000";

  const run = (over: { forecast?: Record<string, number>; real?: Record<string, string> } = {}) =>
    generateGeoJsonForecastData(
      [{ datetimeUtc: TARGET_TIME, forecastValues: over.forecast ?? forecastValues }],
      TARGET_TIME,
      makeCombinedData(systemData, [
        {
          datetimeUtc: TARGET_TIME,
          generationKwByGspId: over.real ?? generationKwByGspId
        } as YieldRow
      ]),
      undefined,
      NationalAggregation.DNO
    );

  test("sums forecast, actuals and capacity across exactly the grouping's members", () => {
    expect(ENWL_GSP_IDS).toHaveLength(17);

    const { forecastGeoJson } = run();
    const feature = forecastGeoJson.features.find((f) => f.properties?.LongName === "ENWL");
    const props = feature?.properties as Record<string, unknown>;

    // 17 members x 1 MW = 17 MW forecast.
    expect(props[SelectedData.expectedPowerGenerationMegawatts]).toBe(17);
    // 17 members x 2000 kW = 34 MW actual.
    expect(props[SelectedData.actualPowerGenerationMegawatts]).toBe(34);
    // 17 members x 10 MW = 170 MW capacity.
    expect(props[SelectedData.installedCapacityMw]).toBe(170);
    // 17 / 170 = 0.1 normalised.
    expect(props[SelectedData.expectedPowerGenerationNormalized]).toBeCloseTo(0.1, 10);
  });

  test("the aggregated feature is re-identified by the DNO's LongName", () => {
    const { forecastGeoJson } = run();
    const feature = forecastGeoJson.features.find((f) => f.properties?.LongName === "ENWL");
    expect(feature?.id).toBe("ENWL");
    expect(feature?.properties?.id).toBe("ENWL");
    expect(feature?.properties?.gspDisplayName).toBe("ENWL");
    expect(feature?.type).toBe("Feature");
  });

  test("the aggregated rounding factor is 1000 MW, so sub-GW totals round to zero", () => {
    const { forecastGeoJson } = run();
    const props = forecastGeoJson.features.find((f) => f.properties?.LongName === "ENWL")
      ?.properties as Record<string, unknown>;
    // CHARACTERISATION: current behaviour is wrong — a 17 MW DNO total displays
    // as 0 in the rounded field because the zone path hardcodes a 1000 MW step.
    expect(props[SelectedData.expectedPowerGenerationMegawattsRounded]).toBe(0);
  });

  test("a single member GSP with no actuals makes the whole DNO total NaN", () => {
    const holed = { ...generationKwByGspId };
    delete holed[String(ENWL_GSP_IDS[0])];

    const { forecastGeoJson } = run({ real: holed });
    const props = forecastGeoJson.features.find((f) => f.properties?.LongName === "ENWL")
      ?.properties as Record<string, unknown>;

    // CHARACTERISATION: current behaviour is wrong — `total += NaN` poisons the
    // whole rollup, so one missing GSP blanks an entire DNO region rather than
    // producing a partial sum or an explicit "incomplete" state.
    expect(props[SelectedData.actualPowerGenerationMegawatts]).toBeNaN();
    // The forecast side is guarded with `|| 0` and survives.
    expect(props[SelectedData.expectedPowerGenerationMegawatts]).toBe(17);
  });

  test("a member GSP missing from the forecast contributes 0 rather than NaN", () => {
    const holed = { ...forecastValues };
    delete holed[String(ENWL_GSP_IDS[0])];

    const { forecastGeoJson } = run({ forecast: holed });
    const props = forecastGeoJson.features.find((f) => f.properties?.LongName === "ENWL")
      ?.properties as Record<string, unknown>;
    // 16 of 17 members contribute — silently, with no signal that data is missing.
    expect(props[SelectedData.expectedPowerGenerationMegawatts]).toBe(16);
  });

  test("member GSPs with no system data contribute 0 capacity", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [{ datetimeUtc: TARGET_TIME, forecastValues }],
      TARGET_TIME,
      makeCombinedData([], [{ datetimeUtc: TARGET_TIME, generationKwByGspId } as YieldRow]),
      undefined,
      NationalAggregation.DNO
    );
    const props = forecastGeoJson.features.find((f) => f.properties?.LongName === "ENWL")
      ?.properties as Record<string, unknown>;
    expect(props[SelectedData.installedCapacityMw]).toBe(0);
    // 17 / (0 || 1) -> 17, another un-clamped "normalised" value.
    expect(props[SelectedData.expectedPowerGenerationNormalized]).toBe(17);
  });

  test("without a targetTime the aggregated view returns no features at all", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [{ datetimeUtc: TARGET_TIME, forecastValues }],
      undefined,
      makeCombinedData(systemData, []),
      undefined,
      NationalAggregation.DNO
    );
    // CHARACTERISATION: current behaviour is wrong — the boundaries disappear
    // entirely rather than rendering empty, so the map goes blank.
    expect(forecastGeoJson.features).toEqual([]);
  });

  test("no feature in the aggregated output has an undefined display name", () => {
    const { forecastGeoJson } = run();
    for (const feature of forecastGeoJson.features) {
      expect(feature.properties?.gspDisplayName).toBeDefined();
      expect(typeof feature.properties?.gspDisplayName).toBe("string");
    }
  });
});

describe("generateGeoJsonForecastData — NG zone aggregation", () => {
  // Give each member GSP a forecast equal to its own id, so the expected total
  // is the arithmetic sum of the grouping's ids (2228 for NW Scotland's 20).
  const forecastValues: Record<string, number> = {};
  const generationKwByGspId: Record<string, string> = {};
  const systemData: Location[] = [];
  for (const id of NW_SCOTLAND_GSP_IDS) {
    forecastValues[String(id)] = id;
    generationKwByGspId[String(id)] = "1000";
    systemData.push(makeLocation({ gspId: id, gspName: `GSP_${id}`, installedCapacityMw: 100 }));
  }

  test("the fixture grouping is the size and sum this test assumes", () => {
    expect(NW_SCOTLAND_GSP_IDS).toHaveLength(20);
    expect(NW_SCOTLAND_GSP_IDS.reduce((a, b) => a + b, 0)).toBe(2228);
  });

  test("sums forecast, actuals and capacity across the zone's members", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [{ datetimeUtc: TARGET_TIME, forecastValues }],
      TARGET_TIME,
      makeCombinedData(systemData, [{ datetimeUtc: TARGET_TIME, generationKwByGspId } as YieldRow]),
      undefined,
      NationalAggregation.zone
    );
    const feature = forecastGeoJson.features.find((f) => f.properties?.id === "NW Scotland");
    const props = feature?.properties as Record<string, unknown>;

    expect(props[SelectedData.expectedPowerGenerationMegawatts]).toBe(2228);
    // 2228 MW to the nearest 1000.
    expect(props[SelectedData.expectedPowerGenerationMegawattsRounded]).toBe(2000);
    // 20 members x 1000 kW = 20 MW.
    expect(props[SelectedData.actualPowerGenerationMegawatts]).toBe(20);
    // 20 members x 100 MW = 2000 MW.
    expect(props[SelectedData.installedCapacityMw]).toBe(2000);
    expect(feature?.id).toBe("NW Scotland");
  });

  test("zones the data says nothing about total zero rather than disappearing", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [{ datetimeUtc: TARGET_TIME, forecastValues }],
      TARGET_TIME,
      makeCombinedData(systemData, [{ datetimeUtc: TARGET_TIME, generationKwByGspId } as YieldRow]),
      undefined,
      NationalAggregation.zone
    );
    expect(forecastGeoJson.features).toHaveLength(19);
    const london = forecastGeoJson.features.find((f) => f.properties?.id === "London");
    const props = london?.properties as Record<string, unknown>;
    expect(props[SelectedData.expectedPowerGenerationMegawatts]).toBe(0);
    // CHARACTERISATION: current behaviour is wrong — a zone with no data at all
    // reports NaN actuals, which the map then paints as a hole.
    expect(props[SelectedData.actualPowerGenerationMegawatts]).toBeNaN();
  });

  test("no zone total is undefined", () => {
    const { forecastGeoJson } = generateGeoJsonForecastData(
      [{ datetimeUtc: TARGET_TIME, forecastValues }],
      TARGET_TIME,
      makeCombinedData(systemData, [{ datetimeUtc: TARGET_TIME, generationKwByGspId } as YieldRow]),
      undefined,
      NationalAggregation.zone
    );
    for (const feature of forecastGeoJson.features) {
      expect(feature.properties?.[SelectedData.expectedPowerGenerationMegawatts]).toBeDefined();
      expect(feature.properties?.[SelectedData.installedCapacityMw]).toBeDefined();
    }
  });
});

describe("generateGeoJsonForecastData — national aggregation", () => {
  test("rolls all 317 grouped GSPs into a single feature", () => {
    const forecastValues: Record<string, number> = {};
    for (const id of nationalGspZone.National) forecastValues[String(id)] = 1;
    // Every GSP contributes 1 MW, so the national total is the grouping size.

    const { forecastGeoJson } = generateGeoJsonForecastData(
      [{ datetimeUtc: TARGET_TIME, forecastValues }],
      TARGET_TIME,
      makeCombinedData([], []),
      undefined,
      NationalAggregation.national
    );

    expect(forecastGeoJson.features).toHaveLength(1);
    const props = forecastGeoJson.features[0].properties as Record<string, unknown>;
    expect(props.id).toBe("National");
    expect(props[SelectedData.expectedPowerGenerationMegawatts]).toBe(317);
    expect(props[SelectedData.expectedPowerGenerationMegawattsRounded]).toBe(0);
  });
});

////////////////////////////////////////
// Realistic fixture-shaped invariants //
////////////////////////////////////////
describe("generateGeoJsonForecastData — against recorded API fixtures", () => {
  const forecastRows = allGspForecastHistoricalDataCompact as unknown as ForecastRow[];
  const actualRows = allGspActualHistoricCompact as unknown as YieldRow[];
  // fc-all.json carries realistic Location objects (gspId / gspName / regionName /
  // installedCapacityMw) for 339 GSPs, including the National pseudo-region.
  const systemData = (fcAll.forecasts as unknown as { location: Location }[])
    .map((f) => f.location)
    .filter((l) => !!l.gspName) as Location[];

  test("the fixtures are the shapes these invariants assume", () => {
    expect(forecastRows.length).toBeGreaterThan(0);
    expect(actualRows.length).toBeGreaterThan(0);
    expect(systemData.length).toBeGreaterThan(300);
  });

  test("a realistic payload keeps every polygon and produces no undefined capacity", () => {
    const targetTime = forecastRows[0].datetimeUtc;
    const { forecastGeoJson } = generateGeoJsonForecastData(
      forecastRows,
      targetTime,
      makeCombinedData(systemData, actualRows)
    );

    expect(forecastGeoJson.features).toHaveLength(349);
    for (const feature of forecastGeoJson.features) {
      expect(feature.properties?.[SelectedData.installedCapacityMw]).toBeDefined();
      expect(Number.isNaN(feature.properties?.[SelectedData.installedCapacityMw])).toBe(false);
      expect(feature.properties?.gspDisplayName).toBeDefined();
    }
  });

  test("most polygons join to the recorded system data by name", () => {
    const targetTime = forecastRows[0].datetimeUtc;
    const { forecastGeoJson } = generateGeoJsonForecastData(
      forecastRows,
      targetTime,
      makeCombinedData(systemData, actualRows)
    );

    const unmatched = forecastGeoJson.features.filter((f) => f.properties?.id === 1000);
    // 349 polygons, 333 distinct names, 299 of which the recorded location data
    // knows about. Pinned as an upper bound: the migration's case-insensitive
    // name match should reduce this, never increase it.
    expect(unmatched.length).toBeLessThanOrEqual(50);
    expect(unmatched.length).toBeGreaterThan(0);
  });

  test("the recorded forecast fixture spans the same timestamps for every GSP", () => {
    const keyCounts = new Set(forecastRows.map((r) => Object.keys(r.forecastValues).length));
    expect(keyCounts.size).toBe(1);
  });

  test("aggregated DNO totals over the recorded fixture are finite and non-negative", () => {
    const targetTime = forecastRows[0].datetimeUtc;
    const { forecastGeoJson } = generateGeoJsonForecastData(
      forecastRows,
      targetTime,
      makeCombinedData(systemData, actualRows),
      undefined,
      NationalAggregation.DNO
    );

    expect(forecastGeoJson.features).toHaveLength(14);
    for (const feature of forecastGeoJson.features) {
      const mw = feature.properties?.[SelectedData.expectedPowerGenerationMegawatts] as number;
      expect(Number.isFinite(mw)).toBe(true);
      expect(mw).toBeGreaterThanOrEqual(0);
    }
  });

  test("summing the DNO rollup over-counts the national total", () => {
    const targetTime = forecastRows[0].datetimeUtc;
    const { forecastGeoJson } = generateGeoJsonForecastData(
      forecastRows,
      targetTime,
      makeCombinedData(systemData, actualRows),
      undefined,
      NationalAggregation.DNO
    );

    const dnoTotal = forecastGeoJson.features.reduce(
      (acc, f) => acc + (f.properties?.[SelectedData.expectedPowerGenerationMegawatts] as number),
      0
    );
    const allGspTotal = Object.values(
      forecastRows.find((r) => r.datetimeUtc === targetTime)!.forecastValues
    ).reduce((a, b) => a + Number(b), 0);

    // CHARACTERISATION: current behaviour is wrong — the DNO rollup should be a
    // partition of the GSP set, so its sum should be <= the all-GSP total.
    // It is strictly greater, because 15 GSP ids appear in two DNO groupings
    // each (see the grouping-overlap test below).
    expect(dnoTotal).toBeGreaterThan(allGspTotal);
  });
});

////////////////////////////////////////////////
// Grouping coverage — the source of the above //
////////////////////////////////////////////////
describe("grouping coverage", () => {
  const flatten = (g: Record<string, number[]>) => Object.values(g).flat();

  test("the DNO groupings are not a partition — 15 GSP ids belong to two DNOs each", () => {
    const all = flatten(dnoGspGroupings as Record<string, number[]>);
    const counts = new Map<number, number>();
    for (const id of all) counts.set(id, (counts.get(id) || 0) + 1);
    const duplicated = [...counts.entries()].filter(([, n]) => n > 1);

    // CHARACTERISATION: current behaviour is wrong — a GSP counted in two DNOs
    // is double-counted in any national rollup and shows the same generation in
    // two places on the map.
    expect(all).toHaveLength(349);
    expect(counts.size).toBe(334);
    expect(duplicated).toHaveLength(15);
    expect(duplicated.every(([, n]) => n === 2)).toBe(true);
    expect(duplicated.map(([id]) => id).sort((a, b) => a - b)).toEqual([
      26, 40, 60, 103, 135, 142, 155, 180, 199, 240, 279, 281, 322, 328, 341
    ]);
  });

  test("the NG-zone groupings ARE a partition, and cover exactly the national grouping", () => {
    const zoneIds = flatten(ngGspZoneGroupings as Record<string, number[]>);
    expect(zoneIds).toHaveLength(317);
    expect(new Set(zoneIds).size).toBe(317);
    expect(new Set(zoneIds)).toEqual(new Set(nationalGspZone.National));
  });

  test("the DNO and national groupings disagree about which GSPs exist", () => {
    const dnoIds = new Set(flatten(dnoGspGroupings as Record<string, number[]>));
    const nationalIds = new Set<number>(nationalGspZone.National);

    // CHARACTERISATION: current behaviour is wrong — the three grouping files
    // are independently maintained and inconsistent. Switching aggregation
    // level silently changes which GSPs are included at all.
    const dnoOnly = [...dnoIds].filter((id) => !nationalIds.has(id));
    const nationalOnly = [...nationalIds].filter((id) => !dnoIds.has(id));
    expect(dnoOnly).toHaveLength(31); // ids 318-348, absent from national/zone
    expect(nationalOnly).toEqual([5, 17, 41, 53, 75, 139, 140, 143, 157, 158, 163, 225, 257, 310]);
  });
});
