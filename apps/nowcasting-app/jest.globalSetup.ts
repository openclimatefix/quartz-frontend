// Runs once in the main jest process, before any worker is forked.
//
// This has to happen here rather than in `setupFiles`: Node resolves the process
// timezone at startup and caches it, so by the time a per-worker setup file runs the
// zone is already fixed and assigning process.env.TZ has no effect. Workers inherit
// this env when they are forked, so setting it here is what actually pins them.
//
// The jest config previously carried `globals: { TZ: "UTC" }`, which injected an
// unused variable into the test sandbox and pinned nothing — tests ran in the
// machine's local zone (Europe/London on a dev laptop, UTC in CI). That is the wrong
// thing to leave to chance in an app whose known defects are timezone defects:
// forecast-window rounding performed in local time against a UTC API, and settlement
// periods computed inconsistently across BST.
module.exports = async () => {
  process.env.TZ = "UTC";
};
