// Table-driven contract test: every recorded v1 API fixture must validate
// against the schema the OpenAPI spec (v1-api.json) declares for the
// request that produced it. This is the tripwire for backend shape drift —
// if production changes what it sends back, this test fails in CI instead
// of the change silently reaching the UI.
//
// Fixtures live in lib/api/v1/__fixtures__/*.json and are recorded verbatim
// by lib/api/v1/__fixtures__/record.mjs (see that file's manifest for
// exactly which request produced which file, and
// lib/api/v1/__fixtures__/README.md for the drift write-up).
//
// ALWAYS import from @jest/globals here — the Cypress chai types in this
// repo win the ambient `expect` collision otherwise.
import { readFileSync } from "fs";
import { join } from "path";

import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, test } from "@jest/globals";

const FIXTURES_DIR = join(__dirname, "__fixtures__");
const SPEC_PATH = join(__dirname, "../../../v1-api.json");

const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

/** Build a standalone schema whose $refs resolve against the spec's components. */
function schemaRef(ref: string) {
  return { components: spec.components, $ref: ref };
}

function arrayOf(ref: string) {
  return { components: spec.components, type: "array", items: { $ref: ref } };
}

const DATE_TIME_STRING_SCHEMA = { type: "string", format: "date-time" };

type FixtureCase = {
  /** Fixture filename under lib/api/v1/__fixtures__/. */
  file: string;
  /** Human label for the request that produced it (mirrors record.mjs's manifest). */
  request: string;
  /** JSON Schema (already resolvable) to validate the fixture body against. */
  schema: object;
  /**
   * When the real payload does NOT validate against the documented schema,
   * this names the discrepancy instead of silently loosening the schema.
   * The test then asserts the REAL (failing) behaviour, characterised.
   */
  characterisation?: string;
};

const fixtures: FixtureCase[] = [
  {
    file: "countries.json",
    request: "GET /countries",
    schema: arrayOf("#/components/schemas/CountryDetail")
  },
  {
    file: "sources.json",
    request: "GET /sources",
    schema: arrayOf("#/components/schemas/Source")
  },
  {
    file: "gb-region-types.json",
    request: "GET /GB/solar/region-types",
    schema: arrayOf("#/components/schemas/RegionType")
  },
  {
    file: "nl-region-types.json",
    request: "GET /NL/solar/region-types",
    schema: arrayOf("#/components/schemas/RegionType")
  },
  {
    file: "gb-generation-sources.json",
    request: "GET /GB/solar/generation-sources",
    schema: arrayOf("#/components/schemas/GenerationSource")
  },
  {
    file: "nl-generation-sources.json",
    request: "GET /NL/solar/generation-sources",
    schema: arrayOf("#/components/schemas/GenerationSource")
  },
  {
    file: "gb-regions-national.json",
    request: "GET /GB/solar/regions?region_type=national",
    schema: arrayOf("#/components/schemas/RegionDetail")
  },
  {
    file: "gb-regions-gsp.json",
    request: "GET /GB/solar/regions?region_type=gsp",
    schema: arrayOf("#/components/schemas/RegionDetail")
  },
  {
    file: "nl-regions-province.json",
    request: "GET /NL/solar/regions?region_type=province",
    schema: arrayOf("#/components/schemas/RegionDetail")
  },
  {
    file: "gb-region-citr_1.json",
    request: "GET /GB/solar/regions/citr_1",
    schema: schemaRef("#/components/schemas/RegionDetail")
  },
  {
    file: "gb-national-forecast.json",
    request: "GET /GB/solar/regions/national/forecast",
    schema: schemaRef("#/components/schemas/ForecastResponse")
  },
  {
    file: "gb-national-forecast-last-updated.json",
    request: "GET /GB/solar/regions/national/forecast/last-updated",
    schema: DATE_TIME_STRING_SCHEMA
  },
  {
    file: "gb-national-generation-pvlive_in_day.json",
    request: "GET /GB/solar/regions/national/generation?observer=pvlive_in_day",
    schema: schemaRef("#/components/schemas/GenerationResponse")
  },
  {
    file: "gb-national-generation-pvlive_day_after.json",
    request: "GET /GB/solar/regions/national/generation?observer=pvlive_day_after",
    schema: schemaRef("#/components/schemas/GenerationResponse")
  },
  {
    file: "nl-national-generation-ned_nl.json",
    request: "GET /NL/solar/regions/national/generation?observer=ned_nl",
    schema: schemaRef("#/components/schemas/GenerationResponse")
  },
  {
    file: "gb-gsp-forecasts-period.json",
    request: "GET /GB/solar/forecasts/period?region_type=gsp",
    schema: schemaRef("#/components/schemas/RegionForecastMatrix")
  },
  {
    file: "gb-gsp-generation-period.json",
    request: "GET /GB/solar/generation/period?region_type=gsp",
    schema: schemaRef("#/components/schemas/RegionGenerationMatrix")
  },
  {
    file: "gb-gsp-forecasts-snapshot.json",
    request: "GET /GB/solar/forecasts/snapshot?region_type=gsp",
    schema: schemaRef("#/components/schemas/ForecastSnapshot")
  },
  {
    file: "gb-gsp-generation-snapshot.json",
    request: "GET /GB/solar/generation/snapshot?region_type=gsp (a settled slot)",
    schema: schemaRef("#/components/schemas/GenerationSnapshot")
  },
  {
    // The same shape read while the newest slot was still publishing. A partial payload
    // must still be a valid one — if the API ever signalled "incomplete" by deviating
    // from the schema, this is what would catch it. See finding 6 in __fixtures__/README.md.
    file: "gb-gsp-generation-snapshot-partial.json",
    request: "GET /GB/solar/generation/snapshot?region_type=gsp (caught mid-publish)",
    schema: schemaRef("#/components/schemas/GenerationSnapshot")
  },
  {
    file: "nl-province-forecasts-period.json",
    request: "GET /NL/solar/forecasts/period?region_type=province",
    schema: schemaRef("#/components/schemas/RegionForecastMatrix")
  },
  {
    file: "error-422-missing-required-query-param.json",
    request: "GET /GB/solar/forecasts/period (region_type omitted)",
    schema: schemaRef("#/components/schemas/HTTPValidationError")
  },
  {
    // CHARACTERISATION: this is a 400, not the 422 the spec documents for
    // this path (only 200/422 are declared), and its body is a plain
    // {"detail": string} — NOT the HTTPValidationError {"detail": [...]}
    // shape used by real validation errors (see the 422 case above). A
    // client that assumes every non-200 v1 response is HTTPValidationError
    // will break on this. See __fixtures__/README.md for the full note.
    file: "error-400-unknown-region-type.json",
    request: "GET /GB/solar/regions?region_type=bogus",
    schema: schemaRef("#/components/schemas/HTTPValidationError"),
    characterisation:
      "actual body is {detail: string}, not HTTPValidationError's {detail: ValidationError[]}; " +
      "status is an undocumented 400 (spec declares only 200/422 for this path)"
  },
  {
    // CHARACTERISATION: same {detail: string} 400 shape as above, this time
    // from the period endpoint rejecting region_type=national — a
    // restriction (period is sub-national only) the spec does not document
    // at all, on a path (/forecasts/period) that only declares 200/422.
    file: "error-400-national-on-period-endpoint.json",
    request: "GET /GB/solar/forecasts/period?region_type=national",
    schema: schemaRef("#/components/schemas/HTTPValidationError"),
    characterisation:
      "actual body is {detail: string}, not HTTPValidationError's {detail: ValidationError[]}; " +
      "status is an undocumented 400, and the region_type=national restriction on /forecasts/period " +
      "is undocumented entirely"
  }
];

describe("v1 API fixture contract", () => {
  test.each(fixtures)(
    "$file matches its documented schema",
    ({ file, schema, characterisation }) => {
      const raw = readFileSync(join(FIXTURES_DIR, file), "utf8");
      const data = JSON.parse(raw);
      const validate = ajv.compile(schema);
      const valid = validate(data);

      if (characterisation) {
        // Real API behaviour deliberately does NOT match the documented schema.
        // Assert that fact rather than silently loosening the schema above.
        expect(valid).toBe(false);
        return;
      }

      if (!valid) {
        const errorPaths = (validate.errors ?? [])
          .map((e) => `${e.instancePath || "<root>"} ${e.message}`)
          .join("; ");
        throw new Error(`${file} failed schema validation: ${errorPaths}`);
      }
      expect(valid).toBe(true);
    }
  );
});
