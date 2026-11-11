describe("UK forecast", () => {
  it("matches the snapshot", () => {
    cy.mockApi();
    cy.login();
    cy.visit("/");
    cy.waitForMap();
    cy.matchImageSnapshot("uk_forecast");
  });
});
