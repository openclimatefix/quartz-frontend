import "cypress-real-events/support";

describe("Quartz Logo's & Documentation Link", () => {
  beforeEach(function () {
    cy.loginToAuth0(Cypress.env("auth0_username"), Cypress.env("auth0_password"));
  });

  it("displays the correct Quartz and OCF logos with appropriate links", () => {
    cy.visit("http://localhost:3002/");
    
    // Check if the (sun and *Quartz* Solar) logo are correctly displayed
    cy.get('img[src="/QUARTZSOLAR_LOGO_ICON.svg"]').should("be.visible");
    cy.get('img[src="/QUARTZSOLAR_LOGO_TEXTONLY_WHITE.svg"]').should("be.visible");

    // Check if the logos link to the main websites
    cy.get('img[src="/QUARTZSOLAR_LOGO_ICON.svg"]')
      .closest("a")
      .should("have.attr", "href", "https://quartz.solar/");

    cy.get('img[src="/QUARTZSOLAR_LOGO_TEXTONLY_WHITE.svg"]')
      .closest("a")
      .should("have.attr", "href", "https://quartz.solar/");

    // Check if the OCF company logo is present in the logo area (after powered by)
    cy.get('img[src="/OCF_icon_wht.svg"]').should("be.visible");

    // Check if the OCF company logo links to the OCF website
    cy.get('img[src="/OCF_icon_wht.svg"]')
      .closest("a")
      .should("have.attr", "href", "https://www.openclimatefix.org/");
  });

  it("contains the correct Documentation link in the user menu", () => {
    cy.visit("http://localhost:3002/");
    cy.get("button").contains("span", "Open user menu").parent("button").should("be.visible").click();
    cy.get("#UserMenu-DocumentationBtn")
      .should("be.visible")
      .and("have.attr", "href", "https://openclimatefix.notion.site/Quartz-Solar-Documentation-0d718915650e4f098470d695aa3494bf")
      .and("contain.text", "Documentation");
  });
});
