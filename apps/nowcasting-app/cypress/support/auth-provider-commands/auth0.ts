// @ts-check
///<reference path="../../global.d.ts" />

export {};

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
      cy.task("generateAuth0Cookie", {
        user: {
          sub: "123456",
          email: "mockuser@example.com",
          name: "Mock User"
        }
      }).then((cookieVal: any) => {
        cy.setCookie("appSession", cookieVal);
      });
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
