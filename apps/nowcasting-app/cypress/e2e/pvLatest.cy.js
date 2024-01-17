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
    cy.get("header #headlessui-menu-items-6").should("not.exist");
    cy.get("header button").contains("Open user menu").should("exist");
    cy.get("header button").contains("Open user menu").parent().click();
    cy.get("header #headlessui-menu-items-6").should("exist");
    cy.get("header #headlessui-menu-items-6").should("be.visible");
    cy.get("header #headlessui-menu-items-6").should("contain", "Documentation");
    cy.get("header #headlessui-menu-items-6").should("contain", "Give feedback");
    cy.get("header #headlessui-menu-items-6").should("contain", "Contact");
    cy.get("header #headlessui-menu-items-6").should("contain", "Sign out");
  });

  ////////////////////////////////
  //  PV FORECAST
  ////////////////////////////////
  // TODO: work out how to actually test the map elements
  it.skip("test the PV Forecast map elements", () => {
    cy.visit("http://localhost:3002/");
    cy.location("href").should("equal", "http://localhost:3002/");
    cy.get("#MapButtonMW").should("exist");
    cy.intercept("https://api-dev.nowcasting.io/v0/solar/GB/gsp/forecast/all/?historic=true").as(
      "getForecastAll"
    );
    cy.wait("@getForecastAll");
    cy.get("#Map-FORECAST").should("exist");
    cy.get("#Map-FORECAST").click(300, 300);
  });
});
