import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, test, beforeEach } from "@jest/globals";

import Header from "./index";
import useSyncEnabledCountries from "../../../hooks/data/use-sync-enabled-countries";

jest.mock("../../../hooks/data/use-sync-enabled-countries", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("./profile-dropdown", () => ({ __esModule: true, default: () => null }));
jest.mock("./country-toggle", () => ({ __esModule: true, default: () => null }));
jest.mock("./data-info-button", () => ({ __esModule: true, default: () => null }));
jest.mock("../../map/country-coverage-banner", () => ({ __esModule: true, default: () => null }));
jest.mock("next/router", () => ({ useRouter: () => ({ pathname: "/" }) }));

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).fetch = fetchMock;
});

describe("Header", () => {
  test("logged out: the enabled-countries sync is not mounted and nothing is fetched", () => {
    render(<Header isLoggedIn={false} />);
    expect(useSyncEnabledCountries).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("logged in: the enabled-countries sync runs", () => {
    render(<Header isLoggedIn />);
    expect(useSyncEnabledCountries).toHaveBeenCalled();
  });
});
