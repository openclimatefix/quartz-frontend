import "cypress-real-events/support";

describe("Load the page", () => {
  beforeEach(function () {
    cy.loginToAuth0(Cypress.env("auth0_username"), Cypress.env("auth0_password"));

    // Mock the clock BEFORE visiting the page
    cy.fixture("manifest.json").then((manifest) => {
      if (manifest?.referenceTime) {
        const now = new Date(manifest.referenceTime);
        cy.clock(now.getTime(), ["Date"]);
      }
    });

    cy.useApiFixtures();
    cy.intercept("GET", "/api/get_token", { accessToken: "FAKE_TOKEN" });
  });

  it("successfully loads", () => {
    cy.visit("http://localhost:3002/");
    cy.location("href").should("equal", "http://localhost:3002/");
  });

  it("matches the snapshot", () => {
    cy.visit("http://localhost:3002/");
    cy.location("href").should("equal", "http://localhost:3002/");
    cy.get("div.chart-data-loading-message", { timeout: 30000 }).should("not.be.visible");
    cy.get(".mapboxgl-canvas", { timeout: 15000 }).should("be.visible");
    cy.get(".recharts-surface", { timeout: 15000 }).should("be.visible");
    cy.wait(20000);
    cy.matchImageSnapshot("Home - default");
  });

  ////////////////////////////////
  //  GENERAL
  ////////////////////////////////
  it("loads the main header elements", () => {
    cy.visit("http://localhost:3002/");
    cy.location("href").should("equal", "http://localhost:3002/");

    // Header
    cy.get("header").should("exist");
    cy.get("header").should("be.visible");

    // Nav
    cy.get("header").should("contain", "PV Forecast");
    cy.get("header").should("contain", "Solar Sites");
    cy.get("header").should("contain", "Delta");

    // Active page is highlighted
    cy.get("header").contains("PV Forecast").should("have.class", "text-ocf-yellow");
    cy.get("header").contains("Solar Sites").should("not.have.class", "text-ocf-yellow");

    // Quartz link
    cy.get("header a[href='https://quartz.solar/']").should("exist");
    cy.get("header a[href='https://quartz.solar/']").should("be.visible");

    // Powered by
    cy.get("header").should("contain", "powered by");
    cy.get("header").contains("powered by").should("exist");
    cy.get("header").contains("powered by").should("be.visible");
    cy.get("header")
      .contains("powered by")
      .siblings("a")
      .first()
      .should("have.attr", "href", "https://www.openclimatefix.org/");

    // Profile dropdown menu
    cy.get("header #UserMenu-4hViewBtn").should("not.exist");
    cy.get("header button").contains("Open user menu").should("exist");
    cy.get("header button").contains("Open user menu").parent().realClick();
    cy.get("header #UserMenu-NhViewBtn").should("exist");
    cy.get("header #UserMenu-NhViewBtn").should("be.visible");
    cy.get("header #UserMenu-NhViewBtn").should("contain", "N-hour forecast");
    cy.get("header #UserMenu-DashboardModeBtn").should("contain", "Dashboard mode");
    cy.get("header #UserMenu-DocumentationBtn").should("contain", "Documentation");
    cy.get("header #UserMenu-ContactBtn").should("contain", "Contact");
    cy.get("header #UserMenu-FeedbackBtn").should("contain", "Give feedback");
    cy.get("header #UserMenu-LogoutBtn").should("contain", "Sign out");
  });

  ////////////////////////////////
  //  PV FORECAST
  ////////////////////////////////
  it("test the PV Forecast map elements", () => {
    cy.visit("http://localhost:3002/");
    cy.location("href").should("equal", "http://localhost:3002/");

    // National chart header
    cy.get('[data-test="national-chart-header"]').contains("National").should("exist");
    cy.get('[data-test="pv-ocf-forecast-headline-figure"]')
      .contains("National")
      .should("be.visible");

    // Headline figures interaction
    cy.get('[data-test="forecast-headline-figures"]').siblings().first().should("exist").click();
    cy.get('[data-test="forecast-headline-figures"]').siblings().next().should("exist");

    cy.get('[data-test="forecast-headline-figures"]').siblings().first().trigger("mouseover");
    cy.get('[data-test="forecast-headline-figures"]')
      .siblings()
      .first()
      .invoke("mouseover")
      .should("contain", "PV Live / OCF Forecast");
    cy.get('[data-test="forecast-headline-figures"]')
      .siblings()
      .first()
      .trigger("mouseout")
      .should("not.contain", "PV Live / OCF Forecast");

    cy.get('[data-test="forecast-headline-figures"]')
      .siblings()
      .next()
      .trigger("mouseover")
      .contains("Next OCF Forecast");
    cy.get('[data-test="forecast-headline-figures"]')
      .siblings()
      .next()
      .trigger("mouseout")
      .should("not.contain", "Next OCF Forecast");

    // TODO: national chart play button
    // TODO: gsp chart header, chart, close button
    // TODO: national pv chart legend - select/deselect lines
    // TODO: national map - date/time, color scale, capacity/generation buttons
  });
});