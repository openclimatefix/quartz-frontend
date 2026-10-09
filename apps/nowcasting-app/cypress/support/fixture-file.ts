// Turns an API request into the name of the fixture file that answers it.
// cypress/scripts/update-fixtures.mjs names the files the same way: change both together.

export type Api = {
  label: string;
  base: string;
};

// Not part of the name: times change on every run, and the rest are noise.
const IGNORED_PARAMS = new Set([
  "UI",
  "start_utc",
  "end_utc",
  "time_utc",
  "timestamp",
  "creation_limit_utc",
  "site_uuids",
  "region_names"
]);

/** e.g. `…/v1/GB/solar/regions?region_type=gsp` → `v1-gb-solar-regions-gsp.json` */
export const fixtureFileFor = (api: Api, url: string) => {
  const { pathname, searchParams } = new URL(url);
  const basePath = new URL(api.base).pathname.replace(/\/$/, "");
  const pathParts = pathname.slice(basePath.length).split("/").filter(Boolean);

  // Sorted by key, so parameter order doesn't matter.
  const queryValues = Array.from(searchParams.entries())
    .filter(([key]) => !IGNORED_PARAMS.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);

  const name = [api.label, ...pathParts, ...queryValues]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "_");
  return `${name}.json`;
};
