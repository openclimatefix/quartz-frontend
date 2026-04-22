import "cypress-real-events/support";

Cypress.Commands.add("shouldHaveRem", { prevSubject: true }, (subject, property, expectedRem) => {
  const el = subject[0];
  const win = el.ownerDocument.defaultView;
  const computedPx = parseFloat(win.getComputedStyle(el)[property]);
  const rootPx = parseFloat(win.getComputedStyle(el.ownerDocument.documentElement).fontSize);
  const actualRem = computedPx / rootPx;
  expect(actualRem).to.be.closeTo(expectedRem, 0.01);
  return subject;
});

Cypress.Commands.add("shouldHaveEm", { prevSubject: true }, (subject, property, expectedEm) => {
  const el = subject[0];
  const win = el.ownerDocument.defaultView;
  const computedPx = parseFloat(win.getComputedStyle(el)[property]);
  const parentPx = parseFloat(win.getComputedStyle(el.parentElement).fontSize);
  const actualEm = computedPx / parentPx;
  expect(actualEm).to.be.closeTo(expectedEm, 0.01);
  return subject;
});

Cypress.on("uncaught:exception", (err, runnable) => {
  return false;
});

describe("Dashboard Mode checks", () => {
  beforeEach(() => {
    cy.viewport(1920, 1080); // Use large screen for dashboard layout assertions
    cy.loginToAuth0(Cypress.env("auth0_username"), Cypress.env("auth0_password"));
    cy.setCookie("dashboardMode", "true");
    cy.visit("http://localhost:3002/");
  });

  it("checks toggle visibility, enables and disables the dashboard mode correctly", () => {
    // Open the user profile dropdown
    cy.get("button")
      .contains("span", "Open user menu", { timeout: 10000 })
      .parent("button")
      .should("be.visible")
      .click();

    // Check toggle exists in menu and click it to turn off dashboard mode
    cy.get("#UserMenu-DashboardModeBtn", { timeout: 10000 })
      .should("be.visible")
      .click({ force: true });
    cy.getCookie("dashboardMode").should("have.property", "value", "false");

    // Open user profile dropdown again and click toggle to turn dashboard mode back on
    cy.get("button")
      .contains("span", "Open user menu", { timeout: 10000 })
      .parent("button")
      .should("be.visible")
      .click();
    cy.get("#UserMenu-DashboardModeBtn", { timeout: 10000 })
      .should("be.visible")
      .click({ force: true });
    cy.getCookie("dashboardMode").should("have.property", "value", "true");
  });

  it("checks National and GSP titles are bigger and line widths are increased", () => {
    cy.visit("http://localhost:3002/");

    // Check national titles and big numbers are bigger
    cy.get('[data-cy="forecast-header-text"]', { timeout: 15000 })
      .first()
      .shouldHaveRem("fontSize", 3.75);

    // Select a GSP
    cy.window().then((win) => {
      if (win.setGlobalState) {
        win.setGlobalState("selectedMapRegionIds", ["122"]);
        win.setGlobalState("clickedMapRegionIds", ["122"]);
      }
    });

    // Check GSP titles are bigger
    cy.get('[data-cy="gsp-header-title"]', { timeout: 20000 })
      .should("exist")
      .shouldHaveRem("fontSize", 2.25);

    // Dash GSP headline figure numeric text are bigger
    cy.get('[data-cy="forecast-header-text"]', { timeout: 15000 })
      .first()
      .shouldHaveRem("fontSize", 3.75);

    // Wait and verify line thickness increased in dashboard mode to at least 3
    cy.get("path.recharts-curve", { timeout: 20000 })
      .should("exist")
      .invoke("attr", "stroke-width")
      .then((width) => {
        expect(parseFloat(width)).to.be.at.least(3);
      });
  });

  it("checks map date measuring unit selectors and bottom color guide are larger", () => {
    cy.visit("http://localhost:3002/");

    // Checking MW/%/Capacity selector size
    cy.get('[data-cy="measuring-unit-button-group"] div').shouldHaveRem("fontSize", 1.25);

    // Play button
    cy.get('[data-cy="play-button"]').shouldHaveRem("fontSize", 1.5);

    // The bottom map color legend
    cy.get('[data-cy="map-legend"] > div').shouldHaveRem("fontSize", 1.25);
  });
});
