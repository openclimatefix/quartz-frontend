/**
 * The country switches in the map extras drawer are for OCF staff only. A regular user's
 * enabled set is every entitled country, so there is nothing for them to switch.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, jest, test } from "@jest/globals";
import MapExtrasDrawer from "./map-extras-drawer";

const mockIsAdmin = jest.fn<() => boolean>();
jest.mock("../../hooks/data", () => ({
  useEnabledCountries: () => ["GB", "NL"],
  useEntitledCountries: () => ({
    countries: [
      { code: "GB", config: { displayName: "Great Britain" } },
      { code: "NL", config: { displayName: "Netherlands" } }
    ],
    isLoading: false,
    error: undefined
  }),
  useFocusedCountry: () => "GB",
  useIsOcfAdmin: () => mockIsAdmin()
}));

describe("map extras drawer country rows", () => {
  const openDrawer = () => fireEvent.click(screen.getByRole("button", { expanded: false }));

  test("an OCF admin with two entitled countries gets the switches", () => {
    mockIsAdmin.mockReturnValue(true);
    render(<MapExtrasDrawer />);
    openDrawer();
    expect(screen.getByText("Netherlands")).toBeInTheDocument();
  });

  test("a regular user with the same entitlement gets no country rows", () => {
    mockIsAdmin.mockReturnValue(false);
    render(<MapExtrasDrawer />);
    // GB's constraints overlay keeps the drawer itself; only the country rows go.
    openDrawer();
    expect(screen.queryByText("Netherlands")).not.toBeInTheDocument();
    expect(screen.queryByText("Great Britain")).not.toBeInTheDocument();
  });
});
