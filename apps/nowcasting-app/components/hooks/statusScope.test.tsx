/**
 * Which products' statuses the banner shows on a page: every enabled country's
 * `statusProduct` on the dashboard, `asset-solar` alone on /sites.
 *
 * Drives the real `useProductStatuses` and `StatusBanner` against one `/products` payload in
 * which every product has an incident, so a row that shows was kept by the page's product
 * list and a row that does not was dropped by it. `useStatus` reads the Status API URL when
 * it is first loaded, so it is required after the variable is set.
 */
import { describe, expect, jest, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { ProductsResponse, ProductStatus } from "../types";

const incident = (key: string, name: string): ProductStatus => ({
  key,
  name,
  status: "warning",
  message: `${name} incident`,
  source: "manual",
  updatedAt: "2026-09-29T09:00:00Z"
});

const PAYLOAD: ProductsResponse = {
  status: "warning",
  products: [
    incident("gb-solar", "GB Solar"),
    incident("nl-solar", "NL Solar"),
    incident("asset-solar", "Asset Solar")
  ],
  lastUpdated: "2026-09-29T09:00:00Z"
};

jest.mock("../helpers/utils", () => ({
  __esModule: true,
  axiosFetcher: () => Promise.resolve(PAYLOAD)
}));

process.env.NEXT_PUBLIC_STATUS_URL = "https://status.test";
const { statusProductsFor, useProductStatuses } = require("./useStatus");
const StatusBanner = require("../layout/StatusBanner").default;

const Banner = ({ isSitesChart, enabled }: { isSitesChart: boolean; enabled: string[] }) => {
  const statuses = useProductStatuses(statusProductsFor(isSitesChart, enabled));
  return <StatusBanner statuses={statuses} />;
};

const renderBanner = (isSitesChart: boolean, enabled: string[]) =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Banner isSitesChart={isSitesChart} enabled={enabled} />
    </SWRConfig>
  );

describe("statusProductsFor", () => {
  test("maps each enabled country to its status product, in enabled order", () => {
    expect(statusProductsFor(false, ["NL", "GB"])).toEqual(["nl-solar", "gb-solar"]);
  });

  test("a country without a status product adds nothing and does not throw", () => {
    expect(statusProductsFor(false, ["GB", "DE"])).toEqual(["gb-solar"]);
    expect(statusProductsFor(false, ["DE", "XX"])).toEqual([]);
  });

  test("the sites page reports on asset-solar alone, whatever countries are enabled", () => {
    expect(statusProductsFor(true, ["GB", "NL"])).toEqual(["asset-solar"]);
  });
});

describe("status banner rows by page", () => {
  test("with GB and NL enabled, both countries' incidents show", async () => {
    renderBanner(false, ["GB", "NL"]);
    await waitFor(() => expect(screen.queryByText(/GB Solar incident/)).not.toBeNull());
    expect(screen.queryByText(/NL Solar incident/)).not.toBeNull();
    expect(screen.queryByText(/Asset Solar incident/)).toBeNull();
  });

  test("with only GB enabled, an NL incident does not show", async () => {
    renderBanner(false, ["GB"]);
    await waitFor(() => expect(screen.queryByText(/GB Solar incident/)).not.toBeNull());
    expect(screen.queryByText(/NL Solar incident/)).toBeNull();
  });

  test("on /sites only the asset-solar incident shows", async () => {
    renderBanner(true, ["GB", "NL"]);
    await waitFor(() => expect(screen.queryByText(/Asset Solar incident/)).not.toBeNull());
    expect(screen.queryByText(/GB Solar incident/)).toBeNull();
    expect(screen.queryByText(/NL Solar incident/)).toBeNull();
  });

  test("a country without a status product shows no row", async () => {
    renderBanner(false, ["DE", "GB"]);
    await waitFor(() => expect(screen.queryByText(/GB Solar incident/)).not.toBeNull());
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
