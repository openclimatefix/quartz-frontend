/**
 * Which products' statuses the banner shows on a page: every enabled country's
 * `product` on the dashboard, `asset-solar` alone on /sites.
 *
 * Drives the real `useProductStatuses` and `StatusBanner` against one `/products` payload in
 * which every product has an incident, so a row that shows was kept by the page's product
 * list and a row that does not was dropped by it. The payload is served by MSW over the
 * real `fetchJson`, so the transport is under test too, not mocked away.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { SWRConfig } from "swr";
import type { ProductsResponse, ProductStatus } from "../types";
import StatusBanner from "../layout/StatusBanner";
import { statusProductsFor, useProductStatuses } from "./useStatus";

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
    incident("asset-solar", "Asset Solar"),
    // Not a Status API product today. Here so the tests show a row for it would still be
    // dropped, because the status registry does not list it.
    incident("de-solar", "DE Solar")
  ],
  lastUpdated: "2026-09-29T09:00:00Z"
};

const STATUS_URL = "https://status.test";

const server = setupServer(http.get(`${STATUS_URL}/products`, () => HttpResponse.json(PAYLOAD)));

beforeAll(() => {
  process.env.NEXT_PUBLIC_STATUS_URL = STATUS_URL;
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  delete process.env.NEXT_PUBLIC_STATUS_URL;
  server.close();
});

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

  test("a country whose product the status registry does not list adds nothing and does not throw", () => {
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

  test("a country whose product the status registry does not list shows no row", async () => {
    renderBanner(false, ["DE", "GB"]);
    await waitFor(() => expect(screen.queryByText(/GB Solar incident/)).not.toBeNull());
    expect(screen.queryByText(/DE Solar incident/)).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
