/// <reference types="cypress" />

import elements from "./elements";
import { getTimeFormats } from "./helpers";

// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }
Cypress.Commands.add("loadApp", () => {
  return cy.visit("/").get(elements.mapLoaded, { timeout: 20000 }).should("exist").wait(1000);
});

// parmas:
// date: number // utc iso date
// addMinutes: number // number of minute to be added to `date`
// should: "equal"|"not-equal" // compare date to ui

Cypress.Commands.add("checkIfTimeUpdatedInUi", (date, addMinutes, should) => {
  const updatedTimes = getTimeFormats(new Date(date), addMinutes);
  const verb = should === "equal" ? "contain" : "not.contain";
  cy.get(elements.nationalTimeReference).should(verb, updatedTimes.londonTime);
  cy.get(elements.gspTimeReference).should(verb, updatedTimes.londonTime);
  cy.get(elements.headerMapTime).should(verb, updatedTimes.londonDateTime);
});

export {};
