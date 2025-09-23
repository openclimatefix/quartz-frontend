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
  it("matches the snapshot", () => {
    // Set the clock to a fixed time of 2025-09-23 11:35
    // This is important to ensure consistent snapshots as the data is time-dependent
    // and the charts will render differently depending on the current time.
    const now = new Date(2025, 8, 23, 11, 35); // Note: month is 0-indexed
    cy.clock(now.getTime(), ["Date"]);
    // cy.tick(1000);

    // Stub API responses for data as of Tue, 23 Sep 2025 11:35:24 GMT
    cy.intercept("/v0/solar/GB/national/forecast?historic=false&only_forecast_values=true&UI", {
      fixture: "national_forecast.json"
    }).as("getNationalForecast");
    cy.intercept("/v0/solar/GB/national/pvlive?regime=in-day&UI", {
      fixture: "national_pvlive.json"
    }).as("getNationalPvLive");

    cy.intercept(
      "/v0/solar/GB/gsp/forecast/all/?historic=true&compact=true&start_datetime_utc*&end_datetime_utc*",
      {
        fixture: "gsp_forecast_all_history.json"
      }
    ).as("getGspForecastAllHistory");
    cy.intercept(
      "/v0/solar/GB/gsp/forecast/all/?compact=true&start_datetime_utc=2025-09-23T11%3A30%3A00%2B00%3A00&UI",
      {
        fixture: "gsp_forecast_all_latest.json"
      }
    ).as("getGspForecastAllLatest");

    cy.intercept("/v0/solar/GB/gsp/pvlive/all?compact=true&end_datetime_utc*", {
      fixture: "gsp_pvlive_history.json"
    }).as("getGspPvLiveHistory");
    cy.intercept(
      "/v0/solar/GB/gsp/pvlive/all?regime=in-day&compact=true&compact=true&start_datetime_utc*",
      {
        fixture: "gsp_pvlive_latest.json"
      }
    ).as("getGspPvLiveLatest");

    cy.intercept(
      "/v0/solar/GB/national/forecast?forecast_horizon_minutes=240&historic=true&only_forecast_values=true&UI",
      { fixture: "national_4_hour_forecast.json" }
    ).as("getNational4HourForecast");

    cy.intercept("/v0/system/GB/gsp/?UI", { fixture: "gsp_list.json" }).as("getGspList");

    // Load page
    cy.visit("http://localhost:3002/");

    // Wait for the stubbed API responses
    cy.wait("@getNationalForecast");
    cy.wait("@getNationalPvLive");
    cy.wait("@getGspForecastAllHistory");
    // cy.wait("@getGspForecastAllLatest");
    cy.wait("@getGspPvLiveHistory");
    cy.wait("@getGspPvLiveLatest");
    cy.wait("@getNational4HourForecast");
    cy.wait("@getGspList");

    // Ensure Auth0 has redirected us back to the local app.
    cy.location("href").should("equal", "http://localhost:3002/");
    // wait for loading message to disappear
    // allow up to 10 seconds for the loading message to disappear
    cy.get("div.chart-data-loading-message", { timeout: 30000 }).should("not.be.visible");
    cy.percySnapshot("Home - default");
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
