import "./commands";
import "@percy/cypress";
import { addMatchImageSnapshotCommand } from '@simonsmith/cypress-image-snapshot/command';

addMatchImageSnapshotCommand({
  failureThreshold: 0.0,
  failureThresholdType: 'percent',
  customDiffConfig: { threshold: 0.1 },
  capture: 'fullPage',
});

Cypress.on("uncaught:exception", () => {
  return false;
});

beforeEach(() => {
  cy.on("uncaught:exception", () => false);
});