describe("DE forecast", () => {
  it("matches the snapshot", () => {
    cy.mockApi();
    cy.login();
    cy.visit("/");

    // toogle to DE
    cy.get('[data-cy="country-toggle-DE"]').click().should("have.attr", "aria-checked", "true");
    cy.waitForMap();
    cy.matchImageSnapshot("de_forecast");
  });
});
