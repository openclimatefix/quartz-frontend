import { describe, expect, test } from "@jest/globals";
import { buildCsvRows, CSVRow, generateCsv, getNHourForecastLabel } from "./csvDownload";
import { CSVColumn } from "../layout/header/csvDownloadModal";

// `CombinedData` carries a dozen unrelated series that the CSV export never reads. The
// fixtures below only populate the four it does, so they are cast through the parameter
// type of the function under test rather than spelled out in full.
type Combined = Parameters<typeof buildCsvRows>[0];

type PvEntry = { datetimeUtc: string; solarGenerationKw: number | null };
type ForecastEntry = {
  targetTime: string;
  expectedPowerGenerationMegawatts: number | null;
  plevels?: Record<string, number>;
};

const combined = (parts: {
  pvRealDayInData?: PvEntry[];
  pvRealDayAfterData?: ForecastEntry[] | PvEntry[];
  nationalForecastData?: ForecastEntry[];
  nationalNHourData?: ForecastEntry[];
}): Combined => parts as unknown as Combined;

const ALL_COLUMNS: CSVColumn[] = [
  "startDateTime",
  "endDateTime",
  "settlementPeriod",
  "solarGenerationPvliveInitial",
  "solarGenerationPvliveUpdated",
  "solarForecast",
  "pLevels",
  "nForecast",
  "delta"
];

const rowsOf = (csv: string) => csv.split("\n");
const cellsOf = (csv: string, lineIndex: number) => rowsOf(csv)[lineIndex].split(",");

describe("buildCsvRows — empty and missing input", () => {
  test.each([
    ["null combinedData", null],
    ["empty combinedData", combined({})],
    ["all series empty arrays", combined({ pvRealDayInData: [], nationalForecastData: [] })]
  ])("%s produces no rows", (_label, input) => {
    expect(buildCsvRows(input as Combined, [[10, 90]])).toEqual([]);
  });
});

describe("buildCsvRows — kW to MW conversion", () => {
  test.each([
    ["pvRealDayInData", "solarGenerationPvliveInitial" as const],
    ["pvRealDayAfterData", "solarGenerationPvliveUpdated" as const]
  ])("%s converts kW to MW by dividing by 1000", (series, field) => {
    const rows = buildCsvRows(
      combined({
        [series]: [
          { datetimeUtc: "2025-01-15T12:00:00+00:00", solarGenerationKw: 6_490_000 },
          { datetimeUtc: "2025-01-15T12:30:00+00:00", solarGenerationKw: 1_234 }
        ]
      } as any),
      []
    );
    expect(rows.map((r) => r[field])).toEqual([6490, 1.234]);
  });

  // B8: a genuine 0 kW reading is data, not a gap. The old truthiness check turned every
  // overnight settlement period into an empty cell.
  test.each([
    ["pvRealDayInData", "solarGenerationPvliveInitial" as const],
    ["pvRealDayAfterData", "solarGenerationPvliveUpdated" as const]
  ])("B8: %s keeps a 0 kW reading as 0 MW, and null as null", (series, field) => {
    const rows = buildCsvRows(
      combined({
        [series]: [
          { datetimeUtc: "2025-01-15T00:00:00+00:00", solarGenerationKw: 0 },
          { datetimeUtc: "2025-01-15T00:30:00+00:00", solarGenerationKw: null },
          { datetimeUtc: "2025-01-15T01:00:00+00:00", solarGenerationKw: 0 }
        ]
      } as any),
      []
    );
    expect(rows.map((r) => r[field])).toEqual([0, null, 0]);
  });
});

describe("buildCsvRows — forecast values", () => {
  test("a 0 MW forecast survives as 0, a missing one becomes null", () => {
    const rows = buildCsvRows(
      combined({
        nationalForecastData: [
          { targetTime: "2025-01-15T00:00:00+00:00", expectedPowerGenerationMegawatts: 0 },
          {
            targetTime: "2025-01-15T00:30:00+00:00",
            expectedPowerGenerationMegawatts: null
          }
        ],
        nationalNHourData: [
          { targetTime: "2025-01-15T00:00:00+00:00", expectedPowerGenerationMegawatts: 0 },
          {
            targetTime: "2025-01-15T00:30:00+00:00",
            expectedPowerGenerationMegawatts: null
          }
        ]
      }),
      []
    );
    expect(rows.map((r) => r.solarForecast)).toEqual([0, null]);
    expect(rows.map((r) => r.nForecast)).toEqual([0, null]);
  });
});

describe("buildCsvRows — delta", () => {
  const at = "2025-01-15T12:00:00+00:00";
  const build = (opts: {
    initialKw?: number | null;
    updatedKw?: number | null;
    forecastMw?: number | null;
  }) =>
    buildCsvRows(
      combined({
        ...(opts.initialKw !== undefined
          ? { pvRealDayInData: [{ datetimeUtc: at, solarGenerationKw: opts.initialKw }] }
          : {}),
        ...(opts.updatedKw !== undefined
          ? { pvRealDayAfterData: [{ datetimeUtc: at, solarGenerationKw: opts.updatedKw }] }
          : {}),
        ...(opts.forecastMw !== undefined
          ? {
              nationalForecastData: [
                { targetTime: at, expectedPowerGenerationMegawatts: opts.forecastMw }
              ]
            }
          : {})
      }),
      []
    )[0];

  test.each([
    [
      "updated wins over initial",
      { initialKw: 1_000_000, updatedKw: 3_000_000, forecastMw: 500 },
      2500
    ],
    ["initial used when updated absent", { initialKw: 1_000_000, forecastMw: 500 }, 500],
    [
      "initial used when updated is null",
      { initialKw: 1_000_000, updatedKw: null, forecastMw: 500 },
      500
    ],
    ["negative delta", { updatedKw: 1_000_000, forecastMw: 1500 }, -500],
    // B8: a 0 MW actual is a real reading, so the delta is -forecast, not null.
    ["B8: zero actual still yields a delta", { updatedKw: 0, forecastMw: 400 }, -400],
    ["zero forecast yields a delta", { updatedKw: 1_000_000, forecastMw: 0 }, 1000],
    ["no actual at all", { forecastMw: 500 }, null],
    ["both actuals null", { initialKw: null, updatedKw: null, forecastMw: 500 }, null],
    ["no forecast", { updatedKw: 1_000_000 }, null],
    ["null forecast", { updatedKw: 1_000_000, forecastMw: null }, null]
  ])("%s", (_label, opts, expected) => {
    expect(build(opts).delta).toBe(expected);
  });
});

describe("buildCsvRows — start/end datetimes and settlement period", () => {
  // end = the series timestamp, start = end - 30 minutes, both rendered in Europe/London.
  // Settlement periods count 30-minute intervals from London midnight, 1-indexed, so the
  // two clock-change days run 46 and 50 periods respectively.
  test.each([
    [
      "GMT midwinter",
      "2025-01-15T12:00:00+00:00",
      "2025-01-15T11:30:00.000+00:00",
      "2025-01-15T12:00:00.000+00:00",
      24
    ],
    [
      "BST midsummer",
      "2025-06-15T12:00:00+00:00",
      "2025-06-15T12:30:00.000+01:00",
      "2025-06-15T13:00:00.000+01:00",
      26
    ],
    [
      "BST first period of the day",
      "2025-06-15T00:00:00+00:00",
      "2025-06-15T00:30:00.000+01:00",
      "2025-06-15T01:00:00.000+01:00",
      2
    ],
    // 2025 spring forward: 01:00 GMT becomes 02:00 BST.
    [
      "2025 spring forward, before the jump",
      "2025-03-30T00:30:00+00:00",
      "2025-03-30T00:00:00.000+00:00",
      "2025-03-30T00:30:00.000+00:00",
      1
    ],
    [
      "2025 spring forward, across the jump",
      "2025-03-30T01:00:00+00:00",
      "2025-03-30T00:30:00.000+00:00",
      "2025-03-30T02:00:00.000+01:00",
      2
    ],
    [
      "2025 spring forward, after the jump",
      "2025-03-30T02:00:00+00:00",
      "2025-03-30T02:30:00.000+01:00",
      "2025-03-30T03:00:00.000+01:00",
      4
    ],
    // 2025 fall back: 02:00 BST becomes 01:00 GMT, so 01:00-02:00 wall clock happens twice.
    [
      "2025 fall back, first pass",
      "2025-10-26T00:30:00+00:00",
      "2025-10-26T01:00:00.000+01:00",
      "2025-10-26T01:30:00.000+01:00",
      3
    ],
    [
      "2025 fall back, across the repeat",
      "2025-10-26T01:00:00+00:00",
      "2025-10-26T01:30:00.000+01:00",
      "2025-10-26T01:00:00.000+00:00",
      4
    ],
    [
      "2025 fall back, second pass",
      "2025-10-26T01:30:00+00:00",
      "2025-10-26T01:00:00.000+00:00",
      "2025-10-26T01:30:00.000+00:00",
      5
    ],
    // 2026 boundaries.
    [
      "2026 spring forward, across the jump",
      "2026-03-29T01:00:00+00:00",
      "2026-03-29T00:30:00.000+00:00",
      "2026-03-29T02:00:00.000+01:00",
      2
    ],
    [
      "2026 spring forward, after the jump",
      "2026-03-29T02:00:00+00:00",
      "2026-03-29T02:30:00.000+01:00",
      "2026-03-29T03:00:00.000+01:00",
      4
    ],
    [
      "2026 fall back, across the repeat",
      "2026-10-25T01:00:00+00:00",
      "2026-10-25T01:30:00.000+01:00",
      "2026-10-25T01:00:00.000+00:00",
      4
    ],
    [
      "2026 fall back, second pass",
      "2026-10-25T01:30:00+00:00",
      "2026-10-25T01:00:00.000+00:00",
      "2026-10-25T01:30:00.000+00:00",
      5
    ]
  ])("%s", (_label, timestamp, expectedStart, expectedEnd, expectedSp) => {
    const [row] = buildCsvRows(
      combined({
        nationalForecastData: [{ targetTime: timestamp, expectedPowerGenerationMegawatts: 1 }]
      }),
      []
    );
    expect(row.startDateTime).toBe(expectedStart);
    expect(row.endDateTime).toBe(expectedEnd);
    expect(row.settlementPeriod).toBe(expectedSp);
  });

  test("settlement periods run 1..48 across a plain GMT day", () => {
    const day = Array.from({ length: 48 }, (_, i) => {
      const minutes = i * 30 + 30; // end of each period
      const hh = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
      const mm = String(minutes % 60).padStart(2, "0");
      const date = minutes >= 1440 ? "2025-01-16" : "2025-01-15";
      return {
        targetTime: `${date}T${hh}:${mm}:00+00:00`,
        expectedPowerGenerationMegawatts: 0
      };
    });
    const rows = buildCsvRows(combined({ nationalForecastData: day }), []);
    expect(rows.map((r) => r.settlementPeriod)).toEqual(
      Array.from({ length: 48 }, (_, i) => i + 1)
    );
  });
});

describe("buildCsvRows — merging series on timestamp", () => {
  test("a timestamp present in one series only still produces a full row", () => {
    const rows = buildCsvRows(
      combined({
        pvRealDayInData: [
          { datetimeUtc: "2025-01-15T00:00:00+00:00", solarGenerationKw: 1_000_000 }
        ],
        pvRealDayAfterData: [
          { datetimeUtc: "2025-01-15T00:30:00+00:00", solarGenerationKw: 2_000_000 }
        ],
        nationalForecastData: [
          { targetTime: "2025-01-15T01:00:00+00:00", expectedPowerGenerationMegawatts: 300 }
        ],
        nationalNHourData: [
          { targetTime: "2025-01-15T01:30:00+00:00", expectedPowerGenerationMegawatts: 400 }
        ]
      }),
      []
    );
    expect(rows).toHaveLength(4);
    expect(
      rows.map((r) => [
        r.solarGenerationPvliveInitial,
        r.solarGenerationPvliveUpdated,
        r.solarForecast,
        r.nForecast
      ])
    ).toEqual([
      [1000, null, null, null],
      [null, 2000, null, null],
      [null, null, 300, null],
      [null, null, null, 400]
    ]);
  });

  test("series sharing a timestamp collapse into a single row", () => {
    const at = "2025-01-15T12:00:00+00:00";
    const rows = buildCsvRows(
      combined({
        pvRealDayInData: [{ datetimeUtc: at, solarGenerationKw: 1_000_000 }],
        pvRealDayAfterData: [{ datetimeUtc: at, solarGenerationKw: 1_100_000 }],
        nationalForecastData: [{ targetTime: at, expectedPowerGenerationMegawatts: 900 }],
        nationalNHourData: [{ targetTime: at, expectedPowerGenerationMegawatts: 950 }]
      }),
      []
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      solarGenerationPvliveInitial: 1000,
      solarGenerationPvliveUpdated: 1100,
      solarForecast: 900,
      nForecast: 950,
      delta: 200
    });
  });

  test("rows are sorted by timestamp string, whatever order the series arrive in", () => {
    const rows = buildCsvRows(
      combined({
        nationalForecastData: [
          { targetTime: "2025-01-15T13:00:00+00:00", expectedPowerGenerationMegawatts: 3 },
          { targetTime: "2025-01-15T11:00:00+00:00", expectedPowerGenerationMegawatts: 1 }
        ],
        nationalNHourData: [
          { targetTime: "2025-01-15T12:00:00+00:00", expectedPowerGenerationMegawatts: 2 }
        ]
      }),
      []
    );
    expect(rows.map((r) => r.endDateTime)).toEqual([
      "2025-01-15T11:00:00.000+00:00",
      "2025-01-15T12:00:00.000+00:00",
      "2025-01-15T13:00:00.000+00:00"
    ]);
  });
});

describe("buildCsvRows — pLevels", () => {
  const forecast = (plevels?: Record<string, number>) =>
    combined({
      nationalForecastData: [
        {
          targetTime: "2025-01-15T12:00:00+00:00",
          expectedPowerGenerationMegawatts: 500,
          plevels
        }
      ]
    });

  test("only the selected bands are collected", () => {
    const [row] = buildCsvRows(
      forecast({ plevel_10: 400, plevel_25: 450, plevel_75: 550, plevel_90: 600 }),
      [[10, 90]]
    );
    expect(row.pLevelValues).toEqual({ 10: 400, 90: 600 });
  });

  test("a band absent from the payload becomes null, not undefined", () => {
    const [row] = buildCsvRows(forecast({ plevel_10: 400 }), [[10, 90]]);
    expect(row.pLevelValues).toEqual({ 10: 400, 90: null });
  });

  test("a missing plevels object leaves every selected band null", () => {
    const [row] = buildCsvRows(forecast(undefined), [[10, 90]]);
    expect(row.pLevelValues).toEqual({ 10: null, 90: null });
  });

  test("a 0 MW band value is kept", () => {
    const [row] = buildCsvRows(forecast({ plevel_10: 0 }), [[10, 90]]);
    expect(row.pLevelValues[10]).toBe(0);
  });

  test("rows built from non-forecast series carry no pLevel values", () => {
    const [row] = buildCsvRows(
      combined({
        pvRealDayInData: [
          { datetimeUtc: "2025-01-15T12:00:00+00:00", solarGenerationKw: 1_000_000 }
        ]
      }),
      [[10, 90]]
    );
    expect(row.pLevelValues).toEqual({});
  });
});

describe("generateCsv", () => {
  const row = (overrides: Partial<CSVRow> = {}): CSVRow => ({
    startDateTime: "2025-01-15T11:30:00.000+00:00",
    endDateTime: "2025-01-15T12:00:00.000+00:00",
    settlementPeriod: 24,
    solarGenerationPvliveInitial: 1000,
    solarGenerationPvliveUpdated: 1100,
    delta: 200,
    solarForecast: 900,
    nForecast: 950,
    pLevelValues: { 10: 400, 90: 600 },
    ...overrides
  });

  test.each([
    ["startDateTime", "Start DateTime", "2025-01-15T11:30:00.000+00:00"],
    ["endDateTime", "End DateTime", "2025-01-15T12:00:00.000+00:00"],
    ["settlementPeriod", "Settlement Period", "24"],
    ["solarGenerationPvliveInitial", "Solar Generation PVLive Initial (MW)", "1000"],
    ["solarGenerationPvliveUpdated", "Solar Generation PVLive Updated (MW)", "1100"],
    ["solarForecast", "Solar Forecast (MW)", "900"],
    ["nForecast", "4-hour forecast (MW)", "950"],
    ["delta", "Delta (MW)", "200"]
  ])("column %s renders one header and one value", (col, header, value) => {
    const csv = generateCsv([row()], [col as CSVColumn], 4, [[10, 90]]);
    expect(rowsOf(csv)).toEqual([header, value]);
  });

  test("the nHourForecast label is interpolated into the header", () => {
    expect(getNHourForecastLabel(2)).toBe("2-hour forecast");
    const csv = generateCsv([row()], ["nForecast"], 2, []);
    expect(rowsOf(csv)[0]).toBe("2-hour forecast (MW)");
  });

  test("every column selected renders the full header row in order", () => {
    const csv = generateCsv([row()], ALL_COLUMNS, 4, [[10, 90]]);
    expect(cellsOf(csv, 0)).toEqual([
      "Start DateTime",
      "End DateTime",
      "Settlement Period",
      "Solar Generation PVLive Initial (MW)",
      "Solar Generation PVLive Updated (MW)",
      "Solar Forecast (MW)",
      "Solar Forecast P10 (MW)",
      "Solar Forecast P90 (MW)",
      "4-hour forecast (MW)",
      "Delta (MW)"
    ]);
    expect(cellsOf(csv, 1)).toEqual([
      "2025-01-15T11:30:00.000+00:00",
      "2025-01-15T12:00:00.000+00:00",
      "24",
      "1000",
      "1100",
      "900",
      "400",
      "600",
      "950",
      "200"
    ]);
  });

  test("header order follows the selectedColumns order, not the config order", () => {
    const csv = generateCsv([row()], ["delta", "settlementPeriod", "startDateTime"], 4, []);
    expect(cellsOf(csv, 0)).toEqual(["Delta (MW)", "Settlement Period", "Start DateTime"]);
    expect(cellsOf(csv, 1)).toEqual(["200", "24", "2025-01-15T11:30:00.000+00:00"]);
  });

  test("an empty column selection yields an empty header line and empty rows", () => {
    expect(generateCsv([row(), row()], [], 4, [[10, 90]])).toBe("\n\n");
  });

  test("no rows yields the header line alone", () => {
    const csv = generateCsv([], ["startDateTime", "delta"], 4, []);
    expect(csv).toBe("Start DateTime,Delta (MW)");
  });

  describe("pLevels column", () => {
    test("expands to one header and one value per selected band, in band order", () => {
      const csv = generateCsv(
        [row({ pLevelValues: { 10: 400, 90: 600, 25: 450, 75: 550 } })],
        ["pLevels"],
        4,
        [
          [10, 90],
          [25, 75]
        ]
      );
      expect(cellsOf(csv, 0)).toEqual([
        "Solar Forecast P10 (MW)",
        "Solar Forecast P90 (MW)",
        "Solar Forecast P25 (MW)",
        "Solar Forecast P75 (MW)"
      ]);
      expect(cellsOf(csv, 1)).toEqual(["400", "600", "450", "550"]);
    });

    test("collapses to nothing when no bands are selected", () => {
      const csv = generateCsv([row()], ["settlementPeriod", "pLevels"], 4, []);
      expect(rowsOf(csv)).toEqual(["Settlement Period", "24"]);
    });

    test("a band with no value renders as an empty cell", () => {
      const csv = generateCsv([row({ pLevelValues: { 10: null } })], ["pLevels"], 4, [[10, 90]]);
      expect(cellsOf(csv, 1)).toEqual(["", ""]);
    });

    test("a 0 MW band renders as 0, not blank", () => {
      const csv = generateCsv([row({ pLevelValues: { 10: 0, 90: 600 } })], ["pLevels"], 4, [
        [10, 90]
      ]);
      expect(cellsOf(csv, 1)).toEqual(["0", "600"]);
    });
  });

  describe("null and zero handling in cells", () => {
    test("null values render as empty cells", () => {
      const csv = generateCsv(
        [
          row({
            settlementPeriod: null,
            solarGenerationPvliveInitial: null,
            solarGenerationPvliveUpdated: null,
            solarForecast: null,
            nForecast: null,
            delta: null
          })
        ],
        ALL_COLUMNS,
        4,
        []
      );
      expect(cellsOf(csv, 1)).toEqual([
        "2025-01-15T11:30:00.000+00:00",
        "2025-01-15T12:00:00.000+00:00",
        "",
        "",
        "",
        "",
        "",
        ""
      ]);
    });

    // B8: `??` keeps zeros; only genuinely-missing values blank out.
    test("B8: zero values render as 0, not empty cells", () => {
      const csv = generateCsv(
        [
          row({
            settlementPeriod: 0,
            solarGenerationPvliveInitial: 0,
            solarGenerationPvliveUpdated: 0,
            solarForecast: 0,
            nForecast: 0,
            delta: 0
          })
        ],
        ALL_COLUMNS,
        4,
        []
      );
      expect(cellsOf(csv, 1)).toEqual([
        "2025-01-15T11:30:00.000+00:00",
        "2025-01-15T12:00:00.000+00:00",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0"
      ]);
    });
  });
});

describe("end to end: buildCsvRows into generateCsv", () => {
  // B8: an overnight run of genuine 0 kW readings must export as 0s across the board.
  test("B8: an overnight run of zeros exports as 0, not blanks", () => {
    const overnight = ["00:00", "00:30", "01:00", "01:30"].map((hhmm) => ({
      datetimeUtc: `2025-01-15T${hhmm}:00+00:00`,
      solarGenerationKw: 0
    }));
    const csv = generateCsv(
      buildCsvRows(
        combined({
          pvRealDayInData: overnight,
          pvRealDayAfterData: overnight,
          nationalForecastData: overnight.map((e) => ({
            targetTime: e.datetimeUtc,
            expectedPowerGenerationMegawatts: 0,
            plevels: { plevel_10: 0, plevel_90: 0 }
          }))
        }),
        [[10, 90]]
      ),
      [
        "settlementPeriod",
        "solarGenerationPvliveInitial",
        "solarGenerationPvliveUpdated",
        "solarForecast",
        "pLevels",
        "delta"
      ],
      4,
      [[10, 90]]
    );
    expect(rowsOf(csv)).toEqual([
      "Settlement Period,Solar Generation PVLive Initial (MW),Solar Generation PVLive Updated (MW),Solar Forecast (MW),Solar Forecast P10 (MW),Solar Forecast P90 (MW),Delta (MW)",
      // The 00:00 row's period starts at 23:30 the previous day, so it is period 48.
      "48,0,0,0,0,0,0",
      "1,0,0,0,0,0,0",
      "2,0,0,0,0,0,0",
      "3,0,0,0,0,0,0"
    ]);
    expect(csv).not.toMatch(/,,/);
  });

  test("a realistic mixed day round-trips through both halves", () => {
    const csv = generateCsv(
      buildCsvRows(
        combined({
          pvRealDayInData: [
            { datetimeUtc: "2025-06-15T11:30:00+00:00", solarGenerationKw: 6_490_000 },
            { datetimeUtc: "2025-06-15T12:00:00+00:00", solarGenerationKw: 6_760_000 }
          ],
          pvRealDayAfterData: [
            { datetimeUtc: "2025-06-15T11:30:00+00:00", solarGenerationKw: 6_500_000 }
          ],
          nationalForecastData: [
            {
              targetTime: "2025-06-15T11:30:00+00:00",
              expectedPowerGenerationMegawatts: 6400,
              plevels: { plevel_10: 6000, plevel_90: 6800 }
            },
            {
              targetTime: "2025-06-15T12:00:00+00:00",
              expectedPowerGenerationMegawatts: 6700,
              plevels: { plevel_10: 6300 }
            }
          ],
          nationalNHourData: [
            { targetTime: "2025-06-15T12:00:00+00:00", expectedPowerGenerationMegawatts: 6650 }
          ]
        }),
        [[10, 90]]
      ),
      ALL_COLUMNS,
      4,
      [[10, 90]]
    );
    expect(rowsOf(csv)).toEqual([
      "Start DateTime,End DateTime,Settlement Period,Solar Generation PVLive Initial (MW),Solar Generation PVLive Updated (MW),Solar Forecast (MW),Solar Forecast P10 (MW),Solar Forecast P90 (MW),4-hour forecast (MW),Delta (MW)",
      "2025-06-15T12:00:00.000+01:00,2025-06-15T12:30:00.000+01:00,25,6490,6500,6400,6000,6800,,100",
      "2025-06-15T12:30:00.000+01:00,2025-06-15T13:00:00.000+01:00,26,6760,,6700,6300,,6650,60"
    ]);
  });
});
