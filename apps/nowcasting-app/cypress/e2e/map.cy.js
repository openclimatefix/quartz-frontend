import elements from "../support/elements";

it("% / MW buttons switch map view", () => {
  cy.loadApp();
  cy.get(elements.MWBtn).click().wait(1000);
  cy.get(elements.map).toMatchImageSnapshot({ name: "mw-view" });
  cy.get(elements.percentageBtn).click().wait(1000);
  cy.get(elements.map).toMatchImageSnapshot({ name: "percentage-view" });
});
