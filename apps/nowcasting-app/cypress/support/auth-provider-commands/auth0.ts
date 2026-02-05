// @ts-check
///<reference path="../../global.d.ts" />

export {};

// Note: this function leaves you on a blank page, so you must call cy.visit()
// afterwards, before continuing with your test.
function loginViaAuth0Ui(username: string, password: string) {
  // Check the redirect URL is set correctly, and we land on the auth0 login page immediately.
  // N.B. not using cy.origin() here because it doesn't seem to work with our Auth0 + Next.js redirect.
  cy.visit("http://localhost:3002/");
  cy.url().should("include", Cypress.env("auth0_domain"));
  cy.get("input#username").type(username);
  cy.get("input#password").type(password, { log: false });
  cy.get("button[data-action-button-primary='true']").click();

  // Ensure Auth0 has redirected us back to local app.
  // Now we use cy.origin() because we're back on the local app.
  cy.origin("http://localhost:3002/", () => {
    cy.visit("http://localhost:3002/");
    cy.location("href").should("equal", "http://localhost:3002/");
  });
}

Cypress.Commands.add("loginToAuth0", (username: string, password: string) => {
  const log = Cypress.log({
    displayName: "AUTH0 LOGIN",
    message: [`🔐 Authenticating | ${username}`],
    autoEnd: false
  });
  log.snapshot("before");

  // Wrap the login in a session to avoid logging in multiple times.
  cy.session(
    `auth0-${username}`,
    () => {
      loginViaAuth0Ui(username, password);
    },
    {
      validate: () => {
        // Validate presence of a valid appSession cookie.
        cy.getAllCookies().then((cookies) => {
          cy.log(cookies.toString());
          let appSessionCookie = cookies.find((cookie) => cookie.name === "appSession");
          expect(appSessionCookie).to.exist;
          expect(appSessionCookie?.value).to.not.be.empty;
        });
      }
    }
  );

  log.snapshot("after");
  log.end();
});
