# HYPERBLAM (vendored)

[HYPERBLAM](https://hyperblam.how) v0.0.4 by Heydon Pickering, from
<https://git.gay/heydon/hyperblam>. Not published to npm — a zip is the only
distribution — so it is vendored rather than depended on.

Only the 18 files the app actually reaches are here, out of 63 in the dist: the
elements `pages/solar-sounds.tsx` uses, plus the primitives and tools they import.
Analysers, MIDI, dials, echo, phaser and the rest are not included. Upgrading
means copying the same subset out of a newer zip and re-running the import trace.

Upstream's `tools/install.js` is deliberately **not** vendored — see `define.ts`.
