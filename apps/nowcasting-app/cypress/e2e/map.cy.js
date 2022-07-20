import elements from "../support/elements";

it("% / MW buttons switch map view", () => {
  cy.loadApp();
  cy.get(elements.MWBtn).click();
  cy.get(elements.map).toMatchImageSnapshot({ name: "mw-view" });
  cy.get(elements.percentageBtn).click();
  cy.get(elements.map).toMatchImageSnapshot({ name: "percentage-view" });
});
