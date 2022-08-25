import { playInterval, now } from "../support/helpers";
import elements from "../support/elements";

describe("Charts", () => {
  before("loadApp", () => {
    cy.loadApp();
  });
  beforeEach("show gsp chart", () => {
    // open GSPF if cloesd
    cy.get(elements.GSPFChart, { timeout: 1000 })
      .should((_) => {})
      .then(($el) => {
        if (!$el.length) {
          cy.get(elements.map).click(300, 400);
          return;
        }
        return;
      });
  });

  describe("National Forecast Header", () => {
    it("should have correct title", () => {
      cy.get(elements.NFActualPv).should("contain", "7.2");
      cy.get(elements.NFNextForecastPv).should("contain", "6.6");
      cy.get(elements.NFSelectedForecastPv).should("contain", "6.8");
    });
  });
  describe("GSPF Chart", () => {
    it("should be visible", () => {
      cy.get(elements.GSPFChart).should("be.visible");
    });
    it("should have title", () => {
      cy.get(elements.GSPFTitle).should("have.text", "Fiddlers Ferry");
    });
    it("should have correct headers values", () => {
      cy.get(elements.GSPFPvValues).should("have.text", "64% | 15 / 24MW");
    });
    it("should look correct", () => {
      cy.get(elements.GSPFChart)
        .scrollIntoView()
        .wait(1000)
        .toMatchImageSnapshot({ name: "gspf-chart" });
    });

    it("close button should close the chart", () => {
      cy.get(elements.GSPFCloseBtn).click();
      cy.get(elements.GSPFChart).should("not.exist");
    });
  });

  describe.only("play/pause/reset button", () => {
    beforeEach("reset time", () => {
      // pause if playing
      cy.get(elements.pauseButton, { timeout: 1000 })
        .should((_) => {})
        .then(($el) => {
          if ($el.length) {
            $el.trigger("click");
          }
          return;
        });
      //reset time in now tag is visible
      cy.get(elements.resetTimeButton).click({ force: true });
    });
    // putting in a separate describe block to avoid clock hell
    describe("play", () => {
      it("hit play button and time should change", function () {
        cy.clock(now);

        cy.checkIfTimeUpdatedInUi(now, null, "equal");
        cy.get(elements.playButton)
          .click()
          .wait(playInterval * 2);
        cy.checkIfTimeUpdatedInUi(now, null, "not-equal");
      });
    });
    describe("pause", () => {
      it("hit pause button and time should not change", function () {
        // play first
        cy.get(elements.playButton).click();
        cy.wait(playInterval * 2);

        //hit pause button
        cy.get(elements.pauseButton).click();
        cy.get(elements.headerMapTime).then(($el) => {
          const prevTime = $el.text();
          cy.wait(playInterval * 2);
          cy.get(elements.headerMapTime).should("contain", prevTime);
        });
      });
    });
    describe("reset", () => {
      it(" reset button should reset time", function () {
        cy.get(elements.headerMapTime).then(($el) => {
          const prevTime = $el.text();
          cy.get(elements.playButton).click();
          cy.wait(playInterval * 2);
          cy.get(elements.pauseButton).click();
          cy.get(elements.resetTimeButton).click();
          cy.get(elements.headerMapTime).should("contain", prevTime);
        });
      });
    });
  });
  describe("hot keys", () => {
    it("should control time with left and right keys", () => {
      cy.window().then((win) => {
        const now = win.window.Date.now();
        cy.get("body").type("{rightarrow}");
        cy.checkIfTimeUpdatedInUi(now, 30, "equal");
        cy.get("body").type("{leftarrow}");
        cy.checkIfTimeUpdatedInUi(now, null, "equal");
      });
    });
    it("should not go out of range", function () {
      cy.window().then((win) => {
        const lastchartTime = "2022-07-07T22:30:00+00:00";
        cy.get("body")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}")
          .type("{rightarrow}");
        cy.checkIfTimeUpdatedInUi(new Date(lastchartTime).getTime(), null, "equal");
      });
    });
  });
});
