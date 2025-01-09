import "cypress-real-events/support";

describe("Load the page", () => {
  beforeEach(function () {
    // cy.visit("http://localhost:3002/");
    cy.loginToAuth0(Cypress.env("auth0_username"), Cypress.env("auth0_password"));
  });
  it("successfully loads", () => {
    // Should now already be logged in and have a session cookie.
    cy.visit("http://localhost:3002/");
    // Ensure Auth0 has redirected us back to the local app.
    cy.location("href").should("equal", "http://localhost:3002/");
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
    //
    cy.get("header a[href='https://quartz.solar/']").should("exist");
    cy.get("header a[href='https://quartz.solar/']").should("be.visible");
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
  // TODO: work out how to actually test the map elements
  it.skip("test the PV Forecast map elements", () => {
    cy.visit("http://localhost:3002/");
    cy.location("href").should("equal", "http://localhost:3002/");
    // TODO: Add tests for the PV Forecast page elements, probably with mocked data.
    // national chart header
    cy.get('[data-test="national-chart-header"]').contains("National").should("exist");
    cy.get('[data-test="pv-ocf-forecast-headline-figure"]')
      .contains("National")
      .should("be.visible");
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
    // national chart play button
    // play icon visible
    // cy.get("data-test=national-chart-play-button").should("exist", "be.visible");
    // // pause icon not visible
    // // play icon visible
    // cy.get("data-test=national-chart-play-button").should("exist", "be.visible").click();
    // cy.get("data-test=national-chart-play-button").should("exist", "be.visible").click();

    // national chart
    // gsp chart header
    // gsp chart
    // gsp chart close button
    // national pv chart legend check that elements are there
    // legend select and deselect lines and check that they disappear and reappear
    // national map with date and time
    // national map with color scale
    // national map buttons for capacity and generation
  });
});
