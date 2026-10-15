/**
 * Guards the test setup itself.
 *
 * The jsdom + RTL + MSW stack here needed four separate fixes to stand up (Node export
 * conditions, Fetch API polyfills, a JSX transform override, and matcher typings routed
 * through @jest/globals), and every one of them is the kind of thing a routine dependency
 * bump silently undoes. Without this file the symptom would surface later as a confusing
 * failure inside an unrelated feature test; here it names the broken piece directly.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "@jest/globals";
import React from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("https://api.example.test/v1/countries", () =>
    HttpResponse.json([{ country: "GB", name: "Great Britain" }])
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("test infrastructure", () => {
  test("renders components and applies jest-dom matchers", () => {
    render(<button type="button">Nederland</button>);
    expect(screen.getByRole("button", { name: "Nederland" })).toBeInTheDocument();
  });

  test("renderHook works, which is how the v1 data hooks get tested", () => {
    const { result } = renderHook(() => React.useState(0));
    act(() => result.current[1](42));
    expect(result.current[0]).toBe(42);
  });

  test("MSW intercepts fetch, which is how v1 responses get mocked", async () => {
    const response = await fetch("https://api.example.test/v1/countries");
    expect(await response.json()).toEqual([{ country: "GB", name: "Great Britain" }]);
  });

  // The API is UTC-only and the app's known date bugs are timezone bugs, so a suite that
  // quietly runs in the machine's local zone is worse than no suite. Fails on any laptop
  // outside UTC if jest.globalSetup.ts stops being applied.
  test("the process timezone is pinned to UTC", () => {
    expect(new Date("2025-07-01T12:00:00Z").getTimezoneOffset()).toBe(0);
    expect(new Date("2025-01-01T12:00:00Z").getTimezoneOffset()).toBe(0);
  });
});
