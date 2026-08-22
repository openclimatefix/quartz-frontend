/**
 * Defines HYPERBLAM's custom elements, replacing upstream's loader.
 *
 * `tools/install.js` scans the DOM for `*-blam` elements and fetches each one's
 * module by URL at runtime:
 *
 *     import(`${path}/elements/${filename}.js`)
 *
 * A template literal resolved against the script's own URL cannot be followed by
 * any bundler, which is why upstream expects to be served as loose files — 63 of
 * them. Defining the elements by hand instead makes the classes ordinary imports:
 * webpack bundles them, the 45 elements this app never touches are simply not
 * vendored, and there is no runtime waterfall of module fetches. What is lost is
 * auto-discovery, which is no loss — the page knows exactly which elements it has.
 *
 * Import this lazily, from inside an effect. The element classes extend
 * `HTMLElement` at module scope, so merely importing this on the server throws.
 */
import { Audio } from "./elements/Audio.js";
import { Bank } from "./elements/Bank.js";
import { Bar } from "./elements/Bar.js";
import { Chain } from "./elements/Chain.js";
import { Limiter } from "./elements/Limiter.js";
import { Note } from "./elements/Note.js";
import { Pan } from "./elements/Pan.js";
import { Reverb } from "./elements/Reverb.js";
import { Sample } from "./elements/Sample.js";
import { Sequencer } from "./elements/Sequencer.js";
import { Track } from "./elements/Track.js";

const ELEMENTS: Record<string, CustomElementConstructor> = {
  "audio-blam": Audio,
  "bank-blam": Bank,
  "bar-blam": Bar,
  "chain-blam": Chain,
  "limiter-blam": Limiter,
  "note-blam": Note,
  "pan-blam": Pan,
  "reverb-blam": Reverb,
  "sample-blam": Sample,
  "sequencer-blam": Sequencer,
  "track-blam": Track
};

/**
 * Defines anything not already defined, then fires `blamready` — which is what
 * every element waits for before wiring itself up.
 *
 * Register any `blamready` listener of your own *before* calling this. Defining
 * an element upgrades the instances already in the page, and each one registers
 * its own `blamready` listener as it upgrades; listeners run in the order they
 * were added, so anything that needs to act before the elements do has to be
 * registered first.
 */
export function defineBlamElements(): void {
  for (const [name, constructor] of Object.entries(ELEMENTS)) {
    if (!customElements.get(name)) customElements.define(name, constructor);
  }
  window.dispatchEvent(new CustomEvent("blamready"));
}
