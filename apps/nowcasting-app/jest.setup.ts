// Runs in every worker, after the test framework is installed.
//
// The timezone is NOT pinned here — Node caches it at startup, so it has to be set
// before workers fork. See jest.globalSetup.ts.

// DOM matchers (toBeInTheDocument, toHaveTextContent, …) for the jsdom suites.
//
// Note the `/jest-globals` entry point rather than the plain package: it augments the
// matchers on `@jest/expect` instead of the global `expect`. This project must import
// `expect` from `@jest/globals` in every suite, because the Cypress types are also in
// scope and their chai `Assertion` wins the collision on the global — a bare
// `expect(1).toBe(1)` does not compile. The plain import would attach the matchers to
// the `expect` nothing here uses.
import "@testing-library/jest-dom/jest-globals";

export {};
