import { addMatchImageSnapshotCommand } from "@simonsmith/cypress-image-snapshot/command";

import { type Api, fixtureFileFor } from "./fixture-file";

declare global {
  namespace Cypress {
    interface Chainable {
      login(): Chainable<void>;
      mockApi(): Chainable<void>;
      waitForMap(): Chainable<void>;
    }
  }
}

addMatchImageSnapshotCommand({
  failureThreshold: 0.001,
  failureThresholdType: "percent",
  customDiffConfig: { threshold: 0.1 },
  capture: "viewport"
});

// Turn off animations so blinking dots dont cause snapshot diffs
const FREEZE_MOTION_CSS =
  "*, *::before, *::after { animation: none !important; transition: none !important; " +
  "caret-color: transparent !important; }";

Cypress.on("window:load", (win) => {
  const style = win.document.createElement("style");
  style.textContent = FREEZE_MOTION_CSS;
  win.document.head.appendChild(style);
});

const TEST_USER = {
  sub: "auth0|e2e",
  name: "E2E User",
  email: "e2e@example.com",
  picture:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='12' fill='%23888'/></svg>",
  countries: ["GB", "NL", "DE"] // If adding a new country, add it here so the test user can access it.
};

Cypress.Commands.add("login", () => {
  cy.task<string>("mintSessionCookie", TEST_USER).then((cookie) =>
    cy.setCookie("appSession", cookie)
  );
});

let missingFixtures = new Set<string>();

afterEach(() => {
  const missing = Array.from(missingFixtures).sort();
  missingFixtures = new Set();
  if (missing.length) throw new Error(`Requests with no fixture:\n${missing.join("\n")}`);
});

Cypress.Commands.add("mockApi", () => {
  const apis: Api[] = Cypress.env("apis");

  cy.fixture("frozen-now.json").then(({ frozenNow }) => {
    cy.clock(new Date(frozenNow).getTime(), ["Date"]);
  });

  cy.task<string[]>("listFixtures").then((files) => {
    const available = new Set(files);
    registerMock(apis, available);
  });
});

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const registerMock = (apis: Api[], available: Set<string>) => {
  const bases = apis.map(({ base }) => base.replace(/\/$/, ""));
  const apiUrls = new RegExp(`^(${bases.map(escapeRegExp).join("|")})(/|\\?|$)`);

  cy.intercept({ url: apiUrls }, (req) => {
    const api = apis.find(({ base }) => req.url.startsWith(base.replace(/\/$/, "")));
    if (!api) return;

    if (req.method === "OPTIONS") {
      req.reply({
        statusCode: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*"
        }
      });
      return;
    }

    const file = fixtureFileFor(api, req.url);
    if (!available.has(file)) {
      missingFixtures.add(file);
      req.reply({ statusCode: 404, body: { detail: `No fixture ${file}` } });
      return;
    }
    req.reply({ fixture: file });
  });
};

Cypress.Commands.add("waitForMap", () => {
  cy.get(".mapboxgl-canvas").should("be.visible");
  cy.wait(30000); // wait for 30sec for map to render
});
