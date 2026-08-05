// Fetch API globals for the jsdom suites. Runs before the test framework.
//
// jsdom deliberately implements only what browsers expose through the DOM, and it does
// not ship the Fetch API primitives (Request/Response/Headers/fetch) or the web stream
// and encoding globals. MSW v2 is built directly on those primitives, so importing it
// under jsdom fails at module load with "ReferenceError: Response is not defined"
// before a single test runs.
//
// Node has perfectly good implementations of all of these, but the jsdom environment
// replaces the global object, so they have to be re-attached explicitly. undici is
// Node's own HTTP stack, so this is the same implementation the runtime uses rather
// than a third-party shim.
//
// The node-environment suites never load this — they already have these globals.

import { TextDecoder, TextEncoder } from "node:util";
import { ReadableStream, TransformStream } from "node:stream/web";

const define = (name: string, value: unknown) => {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
    enumerable: false
  });
};

// Order matters, and this is why undici is pulled in with `require` below rather than a
// top-level import: undici reads TextDecoder from the global scope as it initialises,
// and ES import bindings are hoisted above everything else in the module. Importing it
// normally therefore evaluates undici before these encoders exist, and the suite dies
// on "ReferenceError: TextDecoder is not defined" inside undici's own encoding module.
define("TextEncoder", TextEncoder);
define("TextDecoder", TextDecoder);
define("ReadableStream", ReadableStream);
define("TransformStream", TransformStream);

const { fetch, FormData, Headers, Request, Response } = require("undici");

define("fetch", fetch);
define("Headers", Headers);
define("Request", Request);
define("Response", Response);
define("FormData", FormData);

// MSW also reaches for BroadcastChannel, which jsdom omits.
if (typeof globalThis.BroadcastChannel === "undefined") {
  const { BroadcastChannel } = require("node:worker_threads");
  define("BroadcastChannel", BroadcastChannel);
}

export {};
