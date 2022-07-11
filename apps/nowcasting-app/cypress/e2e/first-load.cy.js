const elements = {
  mainChart: "[data-e2e=main-chart]",
  mapLoaded: "[data-e2e=map-loaded]",
};
it("Match Image Snapshot - whole page", () => {
  cy.visit("/").get(elements.mapLoaded, { timeout: 20000 }).should("exist");
  cy.document().toMatchImageSnapshot();
});
