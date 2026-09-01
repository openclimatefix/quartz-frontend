import React from "react";

import { sortCountryCodes } from "../../config/countries";
import { setFocusedCountry } from "../helpers/globalState";
import {
  useCountries,
  useEnabledCountries,
  useFocusedCountry
} from "../../hooks/data/use-countries";

// Which country the chart is reading. The other half of the Phase 6 country split
// (`docs/phase6-layout-contract.md` §1, §7).
//
// It sits in the chart header rather than the top nav because focus is almost entirely a
// chart concern — it owns the national series, the capacity figure, the level selector and
// the number/date formatting — and the header already carries the *enabled* set. Two
// questions, two controls, each next to the thing it changes.
//
// It offers only the enabled countries: choosing a country that is not on the map would
// silently enable it, which is the muddle this arrangement exists to avoid. Add it in the
// header first, then read it here.
//
// ## Why this is a sliding track and the header's control is not
//
// The two controls used to be the same object — a segmented row of yellow-on-black codes —
// while meaning opposite things. The header's is a *set* (independent on/off, several at
// once); this one is *one of N*. Same shape teaches one grammar and applies it to both, so
// whichever the user meets first makes the other lie.
//
// A single thumb on a shared track cannot express "both", so the grammars can no longer be
// confused structurally rather than by styling. The corollary is a constraint on the header:
// **it must not slide.** Independent lamps, no thumb, no travel.
//
// The movement also discharges contract §1, which wants focus changing *from the map* to be
// signalled rather than silent. One mechanism does both jobs — an invitation when you look at
// it, and a notification when the thumb moves on its own — which is why the two cases are
// timed differently below.

/**
 * The size chain of the `National` title this control sits beside, one step down it at every
 * breakpoint. Tracking the title's own chain rather than picking a fixed size is what keeps
 * the relationship constant across widths; matching it exactly was tried first and read as
 * the country competing with the heading rather than qualifying it.
 *
 * Written as one literal string because Tailwind scans source for whole class names.
 */
const CODE_SIZE =
  "text-sm md:text-base lg:text-xl dash:xl:text-2xl dash:2xl:text-3xl dash:3xl:text-4xl";

/** Slide timings, ms. See `useFocusOrigin` for why the map-driven case is slower. */
const SLIDE_CHOSEN = 200;
const SLIDE_HANDED = 420;

const TRACK_BASE = "relative isolate inline-grid -my-1 rounded bg-surface-raised align-middle";
const CELL_BASE = `${CODE_SIZE} relative z-10 px-2 py-0.5 font-bold leading-tight rounded transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-content`;
const CELL_FOCUSED = "text-content-on-accent";
const CELL_AVAILABLE = "text-content hover:text-content";

/**
 * Where the current focus came from, and therefore how fast the thumb should travel.
 *
 * Choosing a country here is a confirmation — the user's eye is already on the control, so it
 * should feel immediate. Focus arriving from a map region click is a *notification*, and the
 * user is looking at the map when it happens; the same 200ms slide in the corner of the eye
 * is easy to miss entirely. So that case travels slower.
 *
 * Travel speed is the whole signal. A ring around the thumb was tried and cut: an outline
 * that appears for the duration of the movement and then vanishes reads as a rendering fault
 * rather than as emphasis, and it fought the one thing actually carrying the meaning.
 *
 * Origin is inferred rather than plumbed: this component knows which changes it caused, so
 * any other change is by definition external. That keeps the global-state seam unchanged —
 * `setFocusedCountry` still takes just a code, from the map or from here.
 */
const useFocusOrigin = (focusedCountry: string) => {
  const chosenHere = React.useRef(false);
  const previous = React.useRef(focusedCountry);
  const [handedOver, setHandedOver] = React.useState(false);

  React.useEffect(() => {
    if (previous.current === focusedCountry) return;
    previous.current = focusedCountry;

    // Our own click already flagged itself; anything else arrived from outside.
    if (chosenHere.current) {
      chosenHere.current = false;
      setHandedOver(false);
      return;
    }

    // Cleared once the slower travel is over, so the next change the user *does* make here
    // is back to being immediate.
    setHandedOver(true);
    const settle = setTimeout(() => setHandedOver(false), SLIDE_HANDED);
    return () => clearTimeout(settle);
  }, [focusedCountry]);

  const choose = React.useCallback((code: string) => {
    chosenHere.current = true;
    setFocusedCountry(code);
  }, []);

  return { handedOver, choose };
};

/**
 * The focused country named with no choice attached, when there is only one to choose.
 *
 * Deliberately the *settled state of the track* — same grey, same height, same type — rather
 * than a smaller label of its own. A single country is the common case while the `countries`
 * claim is still landing, so this is what most users see, and it should read as the same
 * object at rest rather than as a different control.
 */
const FocusedCountryLabel: React.FC<{ code: string; title: string }> = ({ code, title }) => (
  <span data-test="chart-country" title={title} className={`${TRACK_BASE} ${CELL_BASE}`}>
    {code}
  </span>
);

/**
 * The country whose numbers the chart is showing, and a way to change it.
 *
 * Rendered from the enabled *codes* rather than from manifest listings, so it is correct the
 * moment the page paints — the codes are synchronous global state, whereas the manifest is
 * an hour-cached request that can cold-start with a retryable 503. The manifest is used only
 * to put a country's full name in the `title`, and its absence costs nothing but the tooltip.
 */
const ChartCountryPicker: React.FC = () => {
  const focusedCountry = useFocusedCountry();
  const enabledCountries = useEnabledCountries();
  const { countries } = useCountries();
  const { handedOver, choose } = useFocusOrigin(focusedCountry);

  const nameOf = (code: string) => countries.find((country) => country.code === code)?.name ?? code;
  const codes = sortCountryCodes(enabledCountries, (code) => code);
  const focusedIndex = codes.indexOf(focusedCountry);

  // One country is not a choice, and this is the common case — a lone highlighted button
  // reads as a control that has lost its other half.
  if (enabledCountries.length === 1) {
    return <FocusedCountryLabel code={focusedCountry} title={nameOf(focusedCountry)} />;
  }

  /**
   * Standard radiogroup keys. Arrow keys move the selection, wrapping, because in a
   * radiogroup selection and focus travel together — which is also what makes the thumb the
   * thing the keyboard drives, rather than a separate focus ring wandering over it.
   */
  const onKeyDown = (event: React.KeyboardEvent) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
    if (step === 0) return;

    event.preventDefault();
    const next = (focusedIndex + step + codes.length) % codes.length;
    choose(codes[next]);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Chart country"
      onKeyDown={onKeyDown}
      className={TRACK_BASE}
      style={{ gridTemplateColumns: `repeat(${codes.length}, minmax(0, 1fr))` }}
    >
      {/*
        The thumb travels; the labels do not. It is taken out of flow and translated by whole
        multiples of its own width — the cells are equal fractions of the track, so an index is
        all the position it needs — while each label stays put and only changes colour. Moving
        the label with the thumb is the version of this that reads as jank.

        `motion-safe` gates the travel, not the colour: under reduced motion the thumb is
        repositioned instantly and the two labels cross-fade between black and white, which is
        the same state change carried by something other than movement.
      */}
      <span
        aria-hidden="true"
        data-test="chart-country-thumb"
        className="absolute inset-y-0 left-0 z-0 rounded bg-selected motion-safe:transition-transform motion-safe:ease-out"
        style={{
          width: `${100 / codes.length}%`,
          transform: `translateX(${Math.max(focusedIndex, 0) * 100}%)`,
          transitionDuration: `${handedOver ? SLIDE_HANDED : SLIDE_CHOSEN}ms`,
          // Focus can briefly name a country the map has stopped drawing; better a track with
          // no thumb for one render than a thumb parked on the wrong country.
          opacity: focusedIndex < 0 ? 0 : 1
        }}
      />

      {codes.map((code) => {
        const focused = code === focusedCountry;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            data-test="chart-country"
            aria-checked={focused}
            // Roving tabindex: the group is one tab stop, and the arrows move within it.
            tabIndex={focused ? 0 : -1}
            title={
              focused ? `${nameOf(code)} — shown in the chart` : `${nameOf(code)} — show in chart`
            }
            onClick={() => choose(code)}
            className={`${CELL_BASE} ${focused ? CELL_FOCUSED : CELL_AVAILABLE}`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
};

export default ChartCountryPicker;
