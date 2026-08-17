/**
 * `useCountryStatus` is a stub, and these tests exist to pin it *as* a stub rather than to
 * describe behaviour worth having.
 *
 * There is no per-country status endpoint (see the hook's doc comment, and the OPEN QUESTIONS
 * in `components/hooks/useStatus.ts`). The failure mode worth guarding is someone reaching for
 * the obvious shortcut — pointing this at `/solar/{country}/status`, or at the GB-hardcoded
 * URL the banner uses — and quietly handing every country GB's incident. So the assertions are
 * "every country is ok" and "nothing is fetched", and either of them failing means the swap to
 * a real endpoint has happened and this file should be rewritten to match it.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { renderHook } from "@testing-library/react";

import { useCountryStatus } from "./use-country-status";

describe("useCountryStatus", () => {
  const originalFetch = global.fetch;
  let fetchSpy: jest.Mock;

  beforeEach(() => {
    fetchSpy = jest.fn(() => {
      throw new Error("useCountryStatus must not fetch while it is a stub");
    });
    global.fetch = fetchSpy as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test.each(["GB", "NL", "DE"])("reports %s as ok with nothing to say", (code) => {
    const { result } = renderHook(() => useCountryStatus(code));

    expect(result.current).toEqual({ level: "ok", message: null });
  });

  // An ok country must carry no message at all: the toggle keys its hover affordance off the
  // message being present, so an empty-string placeholder here would put a dead tooltip on
  // every country in the header.
  test("an ok status has a null message, not an empty string", () => {
    const { result } = renderHook(() => useCountryStatus("GB"));

    expect(result.current.message).toBeNull();
  });

  test("asks no API anything", () => {
    renderHook(() => useCountryStatus("NL"));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
