import Router from "next/router";
import * as Sentry from "@sentry/nextjs";

// Single shared, cached access token for the whole app.
//
// Before this, every API call (axiosFetcherAuth, satelliteLayer's tif fetches, and now
// the v1 client) made its own /api/get_token round trip — an Auth0 session lookup on the
// Next server, not a cheap read. A single map view with a satellite composite and a
// handful of SWR-driven charts could fire a dozen+ of these in a burst. Share one
// in-flight/cached promise across every caller instead.
//
// TTL is far shorter than the token's own lifetime (Auth0 session tokens here live for
// minutes), so this can only ever collapse a burst of near-simultaneous callers — it can
// never serve a token stale enough to be rejected by the API. 60s matches the value
// satelliteLayer.ts proved out for exactly this trade-off.
const TOKEN_TTL_MS = 60_000;

let tokenPromise: Promise<string> | null = null;
let tokenFetchedAt = 0;

async function fetchToken(): Promise<string> {
  const response = await fetch("/api/get_token");
  if (!response.ok) {
    const body = await response.json().catch((parseErr) => {
      Sentry.captureException(parseErr, { tags: { error: "get_token_parse_failure" } });
      return {};
    });
    if (body.error === "trial_expired") {
      Router.push(`/expired${body.email ? `?email=${encodeURIComponent(body.email)}` : ""}`);
      throw new Error("trial_expired");
    }
    if (body.error === "access_denied") {
      Router.push(`/auth/denied?error_description=${encodeURIComponent(body.message)}`);
      throw new Error("access_denied");
    }
    const text = body.message || response.statusText;
    throw new Error(`Failed to get access token (${response.status}): ${text}`);
  }
  const { accessToken } = await response.json();
  return accessToken as string;
}

// Returns the shared access token, fetching it at most once per TTL window. Concurrent
// callers within that window share a single in-flight promise, so a burst of requests
// produces exactly one /api/get_token call.
export async function getAccessToken(): Promise<string> {
  if (tokenPromise && Date.now() - tokenFetchedAt < TOKEN_TTL_MS) return tokenPromise;

  tokenFetchedAt = Date.now();
  tokenPromise = fetchToken();

  // Never cache a rejection: drop it so the next caller retries, rather than replaying
  // one failed auth call for the rest of the TTL. Attach the .catch() to a local
  // reference, not the shared variable, and only clear the cache if it still points at
  // this same promise (a newer fetch may already have replaced it) — either way this
  // handler only ever clears state, it never rethrows, so it can't produce an unhandled
  // rejection. The caller still sees the original rejection via the returned promise.
  const pending = tokenPromise;
  pending.catch(() => {
    if (tokenPromise === pending) tokenPromise = null;
  });

  return pending;
}

// Test-only escape hatch: clears the cache so each test starts from a clean slate.
export function resetTokenCache(): void {
  tokenPromise = null;
  tokenFetchedAt = 0;
}
