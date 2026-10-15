const NowcastingTestEnvironment = require("../../jest.environment");

/**
 * The project's environment with the process zone set to Europe/London for one test file.
 *
 * The suite pins TZ=UTC in `jest.globalSetup.ts`, and the sandbox's `process.env` is a copy, so a
 * test cannot change the zone from inside. This file runs outside the sandbox, where assigning
 * `process.env.TZ` reaches the real process, and the zone is put back on teardown so the next
 * file in the same worker sees UTC again. Opt in with a docblock:
 *   @jest-environment <rootDir>/components/helpers/london.environment.js
 */
class LondonTestEnvironment extends NowcastingTestEnvironment {
  constructor(config, context) {
    super(config, context);
    this.previousTz = process.env.TZ;
    process.env.TZ = "Europe/London";
  }

  async teardown() {
    if (this.previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = this.previousTz;
    await super.teardown();
  }
}

module.exports = LondonTestEnvironment;
