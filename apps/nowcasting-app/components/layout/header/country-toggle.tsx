import React from "react";

import { toggleCountryEnabled } from "../../helpers/globalState";
import { sortCountryCodes } from "../../../config/countries";
import { useCountries, useEnabledCountries } from "../../../hooks/data/use-countries";
import { useCountryStatus } from "../../../hooks/data/use-country-status";
import type { CountryStatus } from "../../../hooks/data/use-country-status";
import type { CountryListing } from "../../../lib/domain/types";

// Which countries draw on the map. A multi-select, and nothing else.
//
// Phase 6 split "which country" in two (`docs/phase6-layout-contract.md` §1): *enabled* is a
// set and belongs to the map, *focused* is one country and belongs to the chart. This
// control owns the first half only. Focus is picked in the chart header, next to the numbers
// it governs — see `components/charts/country-picker.tsx` — because that is where the choice
// has a visible effect, and putting both in the header made one gesture quietly do two
// things.
//
// `/countries` returns every country the API serves, by design, so prospects can see what
// exists before a subscription completes — which is why an unentitled country is rendered
// *disabled* rather than hidden. This is the one place entitlement gates a write: the
// enabled set is persisted, so it must never come to hold a country the user cannot see.
//
// ## Why this is a bank of switches and the chart's control is not
//
// The chart's picker is one-of-N and says so structurally: a single thumb sliding along a
// shared track, which cannot express "both". This one is a *set*, so it must not borrow any
// of that vocabulary — **no thumb, no travel, nothing that slides.** The two controls used to
// be the same segmented row of yellow-on-black codes while meaning opposite things, and
// whichever a user met first taught them a grammar the other one broke.
//
// Two things carry "bank of switches" here. On and off are separately designed rather than two
// shades of the same fill: a lit segment holds the brand yellow, and a dark one has no fill at
// all, dropping into the header's black so it reads as *switched off* rather than as merely
// not-currently-chosen. And every segment keeps a status disc in the same place in both states —
// a lamp that stays put whether lit or dark is the one thing a segmented control never has,
// because a segmented control has nothing to say about the options you did not pick.
//
// What used to be a third thing — a bonded pill, drawn as a dark trough with a ring around it —
// is gone. It was the strongest cue of all, and it was cueing the wrong control: a rounded,
// filled, outlined container of country codes is precisely what the chart's track is. Two of
// them on one screen read as one control in two places, whatever the contents did. The segments
// carry the grouping on their own now, by sitting together and by sharing a design.

/**
 * Layout only — no ground, no edge. See the note above on why the container went.
 *
 * The gap grew with it: 2px was set when a trough held the segments together and only had to
 * part them slightly. With nothing enclosing them, separately switchable things need visibly
 * separate hit targets, or two adjacent lit segments merge back into one bar of yellow.
 */
const PILL_BASE = "inline-flex items-center gap-1.5";

const SEGMENT_BASE =
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-content";
/**
 * Lit: the brand yellow held back with opacity rather than swapped for a different token, so the
 * header's black shows through and dims it. The headroom that gives up is what the lamp spends —
 * a bright disc needs a ground to be bright *against*, and yellow at full strength left none.
 * One colour, two strengths; the opacity is the knob if it wants to be lighter or darker.
 */
const SEGMENT_ON = "bg-surface-raised text-selected ring-1 ring-inset ring-selected-edge";
/** Dark: no fill of its own, so the segment is the header's own black and reads as a gap. */
const SEGMENT_OFF =
  "bg-transparent text-content-muted hover:bg-surface-raised/40 hover:text-content";
const SEGMENT_UNAVAILABLE = "bg-transparent text-surface-raised cursor-not-allowed";

/**
 * The lamp: lit countries carry a filled disc, dark ones a hollow ring in the same place, so
 * the eye tracks one lamp changing state rather than an ornament appearing and vanishing.
 *
 * The lit disc is full-strength `interactive` against a segment holding the same colour at 70%,
 * which is what makes it read as *lit* rather than merely present — the segment deliberately
 * gives up the headroom for it. The black outline is what stops the two strengths of one colour
 * blurring into each other at this size.
 *
 * Status keeps the same filled disc and only changes its colour, so a country with something
 * wrong is not a new shape to learn — it is the lamp you were already reading, in a colour that
 * is not yellow.
 *
 * 10px with a 2px ring: the ring is the whole of the off state, and at 1px on an 8px disc it
 * read as a smudge rather than as a lamp with an off position.
 */
const DISC_BASE = "h-2.5 w-2.5 shrink-0 rounded-full border-2 transition-colors";
/** Lit and nothing to report — full-strength yellow against the segment's held-back yellow. */
const DISC_OK_ON = "border-content-on-accent bg-status-ok";
/**
 * Dark, and nothing to report. Status never tints an off country: it is not being drawn, so
 * reporting on its pipeline would be answering a question nobody asked.
 */
const DISC_OFF = "border-surface-raised";
const DISC_UNAVAILABLE = "border-surface-raised";
/**
 * The lamp in a colour that is not the interactive orange. `status-warn` (Visualisation Orange) for the
 * warning: dusty (`#FFAC5F`) is a slightly different yellow, and a warning that has to be
 * compared against the lamp beside it to be noticed is not a warning. There is no red token in
 * the palette; `red-500` follows the precedent in `DataLoadingChartStatus.tsx`.
 *
 * Same black outline as the ok lamp, because only the fill is carrying the difference.
 */
const DISC_STATUS: Record<"warning" | "error", string> = {
  warning: "border-content-on-accent bg-status-warn",
  error: "border-content-on-accent bg-status-alert"
};

/**
 * A country can be chosen only if the user is entitled to it *and* this build has a
 * registry entry for it. Without an entry there are no boundaries to draw and no timezone
 * to render in, so selecting it would be a crash rather than a degraded view — the same
 * rule `useEntitledCountries` applies when fanning out.
 */
const isSelectable = (country: CountryListing): boolean => country.entitled && country.configured;

const unselectableReason = (country: CountryListing): string =>
  country.configured ? "No access" : "Not available in this build";

/**
 * The lamp. Filled when the country is lit, a hollow ring when it is not, and a colour other
 * than yellow only in the one combination where a colour means anything: lit *and* not ok.
 *
 * `aria-hidden` because colour is never the carrier — the tooltip beside it says the same
 * thing in words, and a disc announced on its own would only add noise.
 */
const StatusDisc: React.FC<{
  code: string;
  enabled: boolean;
  selectable: boolean;
  status: CountryStatus;
}> = ({ code, enabled, selectable, status }) => {
  const state = !selectable
    ? DISC_UNAVAILABLE
    : !enabled
    ? DISC_OFF
    : status.level === "ok"
    ? DISC_OK_ON
    : DISC_STATUS[status.level];

  return (
    <span
      aria-hidden="true"
      data-test={`country-disc-${code}`}
      className={`${DISC_BASE} ${state}`}
    />
  );
};

/**
 * One switch in the bank.
 *
 * Rendered as a real `<button disabled>` rather than a styled `<div>` so an unentitled
 * country is unclickable, unfocusable and announced as disabled, rather than merely looking
 * greyed out. `aria-pressed` carries the enabled state — this is a set of independent
 * toggles, not a radio group, and that is the whole reason it looks nothing like the chart's
 * picker.
 *
 * The last enabled country is `disabled` too: an empty set is a blank map with no way back.
 * `setEnabledCountries` refuses it as well, but the button should not pretend otherwise.
 *
 * A status affordance only exists when there is a status. An ok country gets no tooltip, no
 * `cursor-help` and no description, so hovering it is never a dead end that promises an
 * explanation and then has none.
 */
const CountryOption: React.FC<{
  country: CountryListing;
  enabled: boolean;
  isLastEnabled: boolean;
  onToggle: (code: string) => void;
}> = ({ country, enabled, isLastEnabled, onToggle }) => {
  const selectable = isSelectable(country);
  const status = useCountryStatus(country.code);

  // Off countries are not drawn, so their pipeline health is not a fact about anything on
  // screen. Suppressing it here rather than in the hook keeps the hook honest about the API.
  const reportable = enabled && selectable && status.level !== "ok" && status.message !== null;
  const statusId = `country-status-${country.code}`;

  const stateClasses = !selectable ? SEGMENT_UNAVAILABLE : enabled ? SEGMENT_ON : SEGMENT_OFF;

  const hint = !selectable
    ? unselectableReason(country)
    : isLastEnabled
    ? "The only country on the map"
    : enabled
    ? "Remove from the map"
    : "Add to the map";

  // The tooltip is a *sibling* of the button rather than a child. Anything inside a button
  // joins its accessible name, so a message rendered in there would have a screen reader
  // announce the whole incident where it should say "GB". Outside and referenced by
  // `aria-describedby` it is a description instead — and `aria-describedby` resolves text from
  // `display: none` nodes, so one element serves the eye on hover and the reader always.
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        disabled={!selectable || isLastEnabled}
        aria-pressed={enabled}
        aria-describedby={reportable ? statusId : undefined}
        title={reportable ? `${country.name} — ${status.message}` : `${country.name} — ${hint}`}
        onClick={() => onToggle(country.code)}
        className={`${SEGMENT_BASE} ${stateClasses} ${reportable ? "cursor-help" : ""}`}
      >
        <StatusDisc code={country.code} enabled={enabled} selectable={selectable} status={status} />
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
};

/** A country named with no choice attached, for the states where a choice would be a lie. */
const CountryLabel: React.FC<{ code: string; title: string }> = ({ code, title }) => (
  <span title={title} className={`${PILL_BASE} px-2 py-0.5 text-sm font-bold text-content`}>
    {code}
  </span>
);

const CountryToggle: React.FC = () => {
  const { countries, isLoading, error } = useCountries();
  const enabledCountries = useEnabledCountries();

  // The manifest is an hour-cached request that can also cold-start with a retryable 503.
  // A momentarily empty control would read as "your countries went away", so both the
  // in-flight and the failed case fall back to naming what is actually drawn. The app is
  // fully usable in either: the enabled set comes from the cookie, not the manifest.
  if (isLoading) {
    return (
      <div className="flex items-center px-2" role="group" aria-label="Countries" aria-busy="true">
        <CountryLabel code={enabledCountries.join(" ")} title="Loading countries" />
      </div>
    );
  }

  if (error || countries.length === 0) {
    return (
      <div className="flex items-center px-2" role="group" aria-label="Countries">
        <CountryLabel code={enabledCountries.join(" ")} title="Country list unavailable" />
      </div>
    );
  }

  // One country is not a choice. Rendering a lone lit segment looks like a switch that has
  // lost the rest of its bank; a plain label says the same thing without the affordance.
  if (countries.length === 1) {
    const only = countries[0];
    return (
      <div className="flex items-center px-2" role="group" aria-label="Countries">
        <CountryLabel code={only.code} title={only.name} />
      </div>
    );
  }

  return (
    <div className="flex items-center px-2" role="group" aria-label="Countries">
      {/* One container, N segments — the pill grows with the country list rather than the
          segments being sized to a fixed track, which is what keeps 1 through 4 countries
          looking like the same object. */}
      <div data-test="country-pill" className={PILL_BASE}>
        {/* Registry order, not the manifest's — the same sequence the chart's country picker and
            the footer's zone stack use. See `sortCountryCodes` in `config/countries.ts`. */}
        {sortCountryCodes(countries, (country) => country.code).map((country) => (
          <CountryOption
            key={country.code}
            country={country}
            enabled={enabledCountries.includes(country.code)}
            isLastEnabled={enabledCountries.length === 1 && enabledCountries[0] === country.code}
            onToggle={toggleCountryEnabled}
          />
        ))}
      </div>
    </div>
  );
};

export default CountryToggle;
