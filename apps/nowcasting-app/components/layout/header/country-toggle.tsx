import React from "react";

import { setFocusedCountry } from "../../helpers/globalState";
import { sortCountryCodes } from "../../../config/countries";
import { useCountries, useFocusedCountry } from "../../../hooks/data/use-countries";
import { useCountryStatus } from "../../../hooks/data/use-country-status";
import type { CountryStatus } from "../../../hooks/data/use-country-status";
import {
  CONTROL_BUTTON_ACTIVE,
  CONTROL_BUTTON_BASE,
  CONTROL_BUTTON_IDLE,
  CONTROL_BUTTON_UNAVAILABLE,
  CONTROL_ROW
} from "../../map/control-button";
import type { CountryListing } from "../../../lib/domain/types";

// Which country the header sends to the chart. A radio group, one country at a time.
//
// Phase 6 split "which country" in two (`docs/phase6-layout-contract.md` §1): *enabled* is a
// set and belongs to the map, *focused* is one country and belongs to the chart. This control
// used to own the enabled half — a bank of independent switches — but the enable/disable UI
// is moving to a sidebar and has not landed yet. Until it does, the enabled set is simply
// every entitled and configured country, kept in sync by `useSyncEnabledCountries`, and this
// control's whole job is focus: which one country the chart, the headline figures and the
// level selector follow. That makes it one-of-N, the same grammar as the chart's own picker
// (`components/charts/country-picker.tsx`, which this borrows its keyboard handling from) —
// that component has no importers right now and is dead code, kept only as the reference this
// one is copying from.
//
// `/countries` returns every country the API serves, by design, so prospects can see what
// exists before a subscription completes — which is why an unentitled country is rendered
// *disabled* rather than hidden. Entitlement and configuration are the only reasons a country
// is unselectable here; nothing about the enabled set is decided in this file any more.

/**
 * Layout only — no ground, no edge. See the note above on why the container went.
 *
 * The gap grew with it: 2px was set when a trough held the segments together and only had to
 * part them slightly. With nothing enclosing them, separately switchable things need visibly
 * separate hit targets, or two adjacent lit segments merge back into one bar of yellow.
 */
/**
 * The control is a single-select, so it is drawn with the app's single-select vocabulary —
 * `CONTROL_ROW` and the `CONTROL_BUTTON_*` set from `components/map/control-button.ts`, the same
 * objects the map dock's Forecast/Delta and GSP/DNO rows are made of. It used to be a bank of
 * rounded switches with a status lamp on every segment, which was the right drawing of the
 * question it used to ask ("which countries are on the map?") and is the wrong drawing of the
 * one it asks now.
 *
 * Nothing here is header-specific. A country picker and a unit picker are the same kind of
 * control, and the header is not a reason for a second appearance.
 */
// `surface-inset` overrides the tray's own `surface-inner`. The dock's trays are cut into a
// panel one step above them, which is what makes the recess and therefore the gaps between
// buttons visible; the header is the floor, so a tray at `surface-inner` sits *above* its
// surroundings and the same structure disappears. Going a step below the header restores it.
// `CONTROL_ROW` minus its ground. The dock's trays are cut into a panel one step above them,
// which is what makes the recess — and therefore the gaps between buttons — visible; the header
// is the floor, so the same tray sits *above* its surroundings and the structure disappears.
// `surface-inset` puts it a step below the header instead. Written out rather than appended,
// because two background utilities in one class string are resolved by stylesheet order, not by
// the order they are written.
const PILL_BASE = `${CONTROL_ROW.replace("bg-surface-inner", "bg-surface-inset")} align-middle`;

// `px-3`, replacing the dock's `px-2`: the dock's buttons are packed into a 260px column and
// share their row with another group, where these are two or three codes with the whole header
// around them and read as cramped at the same padding.
const SEGMENT_BASE = `${CONTROL_BUTTON_BASE.replace(
  "px-2",
  "px-3"
)} gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-content`;
const SEGMENT_ON = CONTROL_BUTTON_ACTIVE;
const SEGMENT_OFF = CONTROL_BUTTON_IDLE;
const SEGMENT_UNAVAILABLE = `${CONTROL_BUTTON_UNAVAILABLE} pointer-events-none`;

/**
 * Status, and only status. The lamp that used to sit on every segment was carrying two things
 * at once — "this country is switched on" and "its pipeline is healthy" — and the first of those
 * is not a question any more. A country with nothing wrong now shows nothing, so a dot in the
 * header always means something needs attention rather than being an ornament to scan past.
 *
 * 6px and no ring: it is a mark beside a label, not a switch with an off position.
 */
const DISC_BASE = "h-1.5 w-1.5 shrink-0 rounded-full";
const DISC_STATUS: Record<"warning" | "error", string> = {
  warning: "bg-status-warn",
  error: "bg-status-alert"
};

/**
 * A country can be chosen only if the user is entitled to it *and* this build has a registry
 * entry for it. Without an entry there are no boundaries to draw and no timezone to render in,
 * so selecting it would be a crash rather than a degraded view — the same rule
 * `useEntitledCountries` applies when fanning out.
 */
const isSelectable = (country: CountryListing): boolean => country.entitled && country.configured;

const unselectableReason = (country: CountryListing): string =>
  country.configured ? "No access" : "Not available in this build";

/**
 * `aria-hidden` because colour is never the carrier — the tooltip beside it says the same
 * thing in words, and a disc announced on its own would only add noise.
 */
const StatusDisc: React.FC<{ code: string; level: "warning" | "error" }> = ({ code, level }) => (
  <span
    aria-hidden="true"
    data-test={`country-disc-${code}`}
    className={`${DISC_BASE} ${DISC_STATUS[level]}`}
  />
);

/** A country named with no choice attached, for the states where a choice would be a lie. */
const CountryLabel: React.FC<{ code: string; title: string }> = ({ code, title }) => (
  <span title={title} className={`${CONTROL_BUTTON_BASE} text-content`}>
    {code}
  </span>
);

/**
 * One radio in the group.
 *
 * Rendered as a real `<button disabled>` rather than a styled `<div>` so an unentitled
 * country is unclickable, unfocusable and announced as disabled, rather than merely looking
 * greyed out. `aria-checked` carries the focused state — this is a radio group, and `role`,
 * `aria-checked` and roving `tabIndex` all say so, matching the chart's own picker.
 *
 * A status affordance only exists when there is a status. An ok country gets no tooltip, no
 * `cursor-help` and no description, so hovering it is never a dead end that promises an
 * explanation and then has none.
 */
const CountryOption = React.forwardRef<
  HTMLButtonElement,
  {
    country: CountryListing;
    focused: boolean;
    onChoose: (code: string) => void;
  }
>(({ country, focused, onChoose }, ref) => {
  const selectable = isSelectable(country);
  const status = useCountryStatus(country.code);

  // An unselectable country is not drawn, so its pipeline health is not a fact about
  // anything on screen. Suppressing it here rather than in the hook keeps the hook honest
  // about the API.
  const reportable = selectable && status.level !== "ok" && status.message !== null;
  const statusId = `country-status-${country.code}`;

  const stateClasses = !selectable ? SEGMENT_UNAVAILABLE : focused ? SEGMENT_ON : SEGMENT_OFF;

  const hint = !selectable
    ? unselectableReason(country)
    : focused
    ? "shown in the chart"
    : "show in the chart";

  // The tooltip is a *sibling* of the button rather than a child. Anything inside a button
  // joins its accessible name, so a message rendered in there would have a screen reader
  // announce the whole incident where it should say "GB". Outside and referenced by
  // `aria-describedby` it is a description instead — and `aria-describedby` resolves text from
  // `display: none` nodes, so one element serves the eye on hover and the reader always.
  return (
    <span className="group relative inline-flex">
      <button
        ref={ref}
        type="button"
        role="radio"
        disabled={!selectable}
        aria-checked={focused}
        tabIndex={focused ? 0 : -1}
        aria-describedby={reportable ? statusId : undefined}
        title={reportable ? `${country.name} — ${status.message}` : `${country.name} — ${hint}`}
        onClick={() => onChoose(country.code)}
        className={`${SEGMENT_BASE} ${stateClasses} ${reportable ? "cursor-help" : ""}`}
      >
        {reportable && status.level !== "ok" && (
          <StatusDisc code={country.code} level={status.level} />
        )}
        {country.code}
      </button>
      {reportable && (
        <span
          id={statusId}
          role="tooltip"
          data-test={`country-status-${country.code}`}
          className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-max max-w-xs -translate-x-1/2 rounded bg-surface-sunken px-2 py-1 text-xs font-normal text-content ring-1 ring-inset ring-surface-raised group-hover:block"
        >
          {status.message}
        </span>
      )}
    </span>
  );
});
CountryOption.displayName = "CountryOption";

const CountryToggle: React.FC = () => {
  const { countries, isLoading, error } = useCountries();
  const focusedCountry = useFocusedCountry();

  // The manifest is an hour-cached request that can also cold-start with a retryable 503.
  // A momentarily empty control would read as "your country went away", so both the
  // in-flight and the failed case fall back to naming what is actually focused. The app is
  // fully usable in either: focus comes from the cookie, not the manifest.
  if (isLoading) {
    return (
      <div className="flex items-center px-2" role="group" aria-label="Countries" aria-busy="true">
        <CountryLabel code={focusedCountry} title="Loading countries" />
      </div>
    );
  }

  if (error || countries.length === 0) {
    return (
      <div className="flex items-center px-2" role="group" aria-label="Countries">
        <CountryLabel code={focusedCountry} title="Country list unavailable" />
      </div>
    );
  }

  // One country is not a choice. Rendering a lone checked radio looks like a group that has
  // lost the rest of its members; a plain label says the same thing without the affordance.
  if (countries.length === 1) {
    const only = countries[0];
    return (
      <div className="flex items-center px-2" role="group" aria-label="Countries">
        <CountryLabel code={only.code} title={only.name} />
      </div>
    );
  }

  return <CountryRadioGroup countries={countries} focusedCountry={focusedCountry} />;
};

/**
 * Registry order, not the manifest's — the same sequence the chart's country picker and the
 * footer's zone stack use. See `sortCountryCodes` in `config/countries.ts`.
 *
 * Split out so arrow-key navigation has a stable, sorted list to step through — the same list
 * that gets rendered, in the same order.
 */
const CountryRadioGroup: React.FC<{
  countries: CountryListing[];
  focusedCountry: string;
}> = ({ countries, focusedCountry }) => {
  const sorted = sortCountryCodes(countries, (country) => country.code);
  const buttonRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const choose = (code: string) => setFocusedCountry(code);

  /**
   * Roving tabindex over a group that can contain disabled radios: `Left`/`Up` and
   * `Right`/`Down` step to the next *selectable* country, wrapping, skipping over any
   * unentitled or unconfigured ones in between rather than landing on something unclickable.
   * Copied from `components/charts/country-picker.tsx`'s arrow handling, widened for the
   * disabled case that control never has to deal with (it only ever lists countries already
   * on the map).
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
    const currentIndex = sorted.findIndex((country) => country.code === focusedCountry);
    const startIndex = currentIndex < 0 ? 0 : currentIndex;

    for (let offset = 1; offset <= sorted.length; offset++) {
      const index =
        (((startIndex + step * offset) % sorted.length) + sorted.length) % sorted.length;
      const next = sorted[index];
      if (isSelectable(next)) {
        choose(next.code);
        buttonRefs.current[next.code]?.focus();
        return;
      }
    }
  };

  return (
    <div className="flex items-center px-2" role="group" aria-label="Countries">
      {/* One container, N segments — the pill grows with the country list rather than the
          segments being sized to a fixed track, which is what keeps 1 through 4 countries
          looking like the same object. */}
      <div
        data-test="country-pill"
        role="radiogroup"
        aria-label="Focused country"
        onKeyDown={onKeyDown}
        className={PILL_BASE}
      >
        {sorted.map((country) => (
          <CountryOption
            key={country.code}
            ref={(el) => {
              buttonRefs.current[country.code] = el;
            }}
            country={country}
            focused={country.code === focusedCountry}
            onChoose={choose}
          />
        ))}
      </div>
    </div>
  );
};

export default CountryToggle;
