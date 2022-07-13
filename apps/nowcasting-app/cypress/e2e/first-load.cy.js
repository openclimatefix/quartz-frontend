const elements = {
  mainChart: "[data-e2e=main-chart]",
  mapLoaded: "[data-e2e=map-loaded]",
};
it.skip("Match Image Snapshot - whole page", () => {
  cy.visit("/").get(elements.mapLoaded, { timeout: 20000 }).should("exist").wait(1000);
  cy.document().toMatchImageSnapshot();
});
