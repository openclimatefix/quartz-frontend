// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
// Import auth0 login command
import "./auth-provider-commands/auth0";

declare global {
  namespace Cypress {
    interface Chainable {
      mapboxClickLngLat(mapId: string, lng: number, lat: number): Chainable<void>;
      waitForMapbox(mapId: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add("waitForMapbox", (mapId) => {
  cy.window({ log: false }).then((win) => {
    const map = (win as any)[mapId]?.current;
    expect(map, `${mapId} not found. Expose your map instance in test mode.`).to.exist;

    // Let Cypress poll until all conditions are true (up to 20s)
    return cy.wrap(null, { timeout: 20000 }).should(() => {
      expect(map.loaded(), "map.loaded()").to.be.true;
      expect(map.isStyleLoaded(), "map.isStyleLoaded()").to.be.true;
      // areTilesLoaded() is a handy extra guard if you use raster/vector tiles
      if (typeof map.areTilesLoaded === "function") {
        expect(map.areTilesLoaded(), "map.areTilesLoaded()").to.be.true;
      }
    });
  });
});

Cypress.Commands.add("mapboxClickLngLat", (mapId, lng, lat) => {
  cy.window().then((win) => {
    const map = (win as any)[mapId]?.current;
    expect(map, `${mapId} not found. Expose your map instance in test mode.`).to.exist;

    const pt = map.project([lng, lat]); // point in CSS pixels relative to map container
    const canvas: HTMLCanvasElement = map.getCanvas();
    const rect = canvas.getBoundingClientRect();

    const x = pt.x; // relative to container’s left
    const y = pt.y; // relative to container’s top

    // Convert to coordinates relative to the canvas element for Cypress .click(x, y)
    const relX = x - (rect.left - canvas.getBoundingClientRect().left);
    const relY = y - (rect.top - canvas.getBoundingClientRect().top);

    cy.wrap(canvas).click(relX, relY, { force: true });
  });
});
