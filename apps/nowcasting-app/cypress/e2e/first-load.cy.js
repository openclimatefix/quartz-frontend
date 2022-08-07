it("Match Image Snapshot - whole page", () => {
  cy.loadApp();
  cy.document().toMatchImageSnapshot();
});
