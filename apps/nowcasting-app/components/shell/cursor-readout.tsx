import { FC } from "react";

import useGlobalState from "../helpers/globalState";
import { useEnabledCountries, useFocusedCountry } from "../../hooks/data";
import { getCountryConfig, sortCountryCodes } from "../../config/countries";
// `cadenceMinutesFor`, not `cursorCadenceMinutes`: each row states its *own* country's cadence,
// and the cursor's grid is simply whichever of those belongs to the focused row. Reading the
// cursor helper here as well would compute the same number by a second route and invite the two
// to disagree — the point of the column is that they are the same fact.
import { cadenceMinutesFor, slotForInstant } from "../../lib/time/cursor";
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, formatISODateStringAsZonedTime } from "../helpers/utils";
import PlayButton from "../play-button";
import ScrubTrack from "./scrub-track";
import useCursorRange from "./use-cursor-range";

/**
 * The shared cursor, said out loud — and, since the Phase 6 live pass, moved as well.
 *
 * Contract §4: with the map and the chart reading one instant, the cursor is what makes them
 * one instrument, so the control belongs to the shell rather than to either pane. Track D
 * shipped the readout and deferred the track; `scrub-track.tsx` is the interaction half, added
 * at Brad's request and mounted below. This followup (Track N) does two things to the footer:
 *
 * 1. **One row, not two.** The readout used to stack above the track as its own full-height
 *    row; it now sits inline to the track's left, with the track filling whatever width is
 *    left. That row's second visual line — the tick labels — belongs to the track alone
 *    (`ScrubTrack`/`TrackTicks`), not to the readout, so it is only as wide as the track and
 *    the footer is shorter for it. `ScrubTrack`'s own horizontal padding was dropped in favour
 *    of this footer's, so the two stay flush.
 * 2. **The axis reads in the focused country's local time, not UTC.** A reader locates a time
 *    of day — dawn, peak, dusk — against a local clock; a UTC axis makes every reading an
 *    arithmetic problem. The zone is reached the same way the rest of this file already reaches
 *    country facts: `getCountryConfig(useFocusedCountry())`. Changing focus changes the zone
 *    (and, via `cursorCadenceMinutes`, the step) together, which is what keeps the handle from
 *    jumping — both come from one call and change on one render.
 *
 * **Track O moved the focused country's primary reading again — off this row entirely.**
 * Sitting at a fixed spot left of the track (Track N's placement, described below for history)
 * did not read as tethered to the handle: Brad's words were "the times changing on one side of
 * the footer don't immediately click as tethered to where the cursor is on the scrub line." The
 * reading now renders inside `ScrubTrack` itself, positioned at the handle's own x and moving
 * with it at pointer rate — see that file. This component no longer computes or renders it;
 * `otherCountries` still excludes the focused country from the secondary list below, since the
 * reading has not stopped being "shown once", it has only moved where that once is.
 *
 * What is on screen, and why each fact earns its place:
 *
 * - **UTC, demoted but not dropped.** It is the one unambiguous instant on screen and the
 *   canonical value everything else derives from; it stays, in the smaller gray type the
 *   country chip used to have, alongside the cadence and the "live" flag.
 * - **every other enabled country's slot**, unchanged in substance from before — its own local
 *   time and the `+15m`-style lag where its cadence is coarser than the cursor grid, which is
 *   the honest signal that two countries are not looking at the same instant. The focused
 *   country no longer appears in this list: it would be the same fact shown twice, once here
 *   and once as the primary reading.
 * - **the grain**, because the cursor steps on the *focused* country's grid. Changing focus
 *   changes the step — GB publishes every 30 minutes, NL every 15 — and the readout is where
 *   that becomes visible rather than mysterious.
 *
 * **The grain and the lag are one column, not two facts in two places.** The grain used to sit
 * beside the play button, grouped with it as "how the cursor moves"; the lag had a reserved
 * fixed-width cell on each country row that was empty most of the time, and the two together
 * read as a gap in the middle of the footer. They are the same subject: the lag exists *because*
 * of the grain, and only for a country whose cadence differs from it. So the stack's third
 * column is now that one subject — **every row states its own cadence, and the focused row's is
 * the grain**, because the cursor steps on exactly that country's grid (`cursorCadenceMinutes`,
 * `lib/time/cursor.ts`):
 *
 * ```
 *   NL focused · GB publishes every 30m, NL every 15m
 *
 *   cursor 17:15 UTC — on NL's grid, not GB's
 *     UTC 17:15
 *     GB  18:30   +15m   gray-300  · GB rounds up to 17:30 UTC; off-grid right now
 *     NL  19:15    15m   white     · the grid itself
 *
 *   cursor 17:00 UTC — on both grids
 *     UTC 17:00
 *     GB  18:00    30m   gray-600  · its cadence, in step
 *     NL  19:00    15m   white     · the grid itself
 * ```
 *
 * **The column is predictive, which is what earns it the space.** Every row is a cadence in the
 * same units, so a row whose number is *larger* than the bold one is a row that can drift off
 * the grid, and one equal or smaller never can — you can see before it happens that GB will
 * diverge on odd quarter-hours and that NL never will while GB leads. A resting row is a fact,
 * not a placeholder, which is the difference between a quiet field and a dead one.
 *
 * **Brightness carries the distinction, not the `+`.** A lag is usually equal to some country's
 * cadence, so `15m` and `+15m` are both the same digits and one character apart; leaning on the
 * sign would rest the whole reading on the character least likely to be noticed. Three steps —
 * white for the grid, gray-300 for a live divergence, gray-600 at rest — with the sign as
 * confirmation. The sign is also *hung outside the number* in a reserved left strip rather than
 * set in the flow, so the digits hold one x position in every state: a column read vertically
 * must not shift sideways at the moment it changes. **The focused row can never lag** (the cursor grid *is* its cadence, so
 * `slotForInstant` is a no-op on it), so the bold cell is always the grain and never an offset.
 *
 * The UTC row has no cell in this column: it is the cursor's canonical instant, not a publisher,
 * and it has no cadence to state.
 *
 * The arithmetic is entirely Track B's (`lib/time/cursor.ts`); nothing here rounds anything.
 *
 * **Track P adds the play button, left of the track.** It used to be mounted twice in the chart
 * header and once more in the sites chart; the footer is its home now (the chart header mounts
 * are gone). It reads `startTime`/`endTime` from this component's own `useCursorRange()` call —
 * the exact same hook `ScrubTrack` calls to draw the strip — rather than a separate derivation,
 * so the window it plays across is by construction the window the track draws. Until that data
 * arrives it is not rendered at all, the same "inert until there is real data" rule the track
 * itself follows rather than guessing a range. See `components/play-button/index.tsx` for the
 * play/follow mutual-exclusion rules, and its doc comment for why `/sites` keeps its own,
 * separately-propped instance rather than losing the control outright.
 */

const CountrySlot: FC<{ code: string; cursor: string; focused: boolean }> = ({
  code,
  cursor,
  focused
}) => {
  const config = getCountryConfig(code);
  const slot = slotForInstant(cursor, code);
  // The country's *timezone*, but not its locale: NL's slot is shown at NL's wall clock,
  // written the GB way. `config.locale` ("nl-NL") stays in the registry for when a per-user
  // display preference lands — until then every date and time in the app reads the same,
  // rather than switching convention halfway along a row. See `lib/time/display.ts`.
  const local = formatISODateStringAsZonedTime(
    slot,
    config?.timezone ?? DEFAULT_TIMEZONE,
    DEFAULT_LOCALE
  );
  // How far the country's slot sits ahead of the cursor. Zero for whichever country owns the
  // grid; a whole cadence step for one that publishes more coarsely.
  const lagMinutes = Math.round(
    (new Date(slot).getTime() - new Date(cursor).getTime()) / (60 * 1000)
  );
  const cadenceMinutes = cadenceMinutesFor(code);

  return (
    <span
      className="flex items-baseline gap-1.5 text-2xs"
      title={`${code} published slot, ${config?.timezone ?? DEFAULT_TIMEZONE}${
        focused ? " — the country the cursor's grid and the axis follow" : ""
      }`}
    >
      {/* Same fixed cells as the UTC row above, so the stack is a column and not a ragged list.
          Focus is weight and colour only — the row never moves. */}
      <span
        className={`w-5 shrink-0 font-bold uppercase tracking-wider ${
          focused ? "text-ocf-yellow" : "text-ocf-gray-600"
        }`}
      >
        {code}
      </span>
      <span
        className={`w-10 shrink-0 tabular-nums ${focused ? "text-white" : "text-ocf-gray-400"}`}
      >
        {local}
      </span>
      {/* The grid column — see this file's doc comment. Always rendered, always the same width:
          its content changes as the cursor steps, and mounting/unmounting it re-flowed the whole
          row on each step, which read as the readout jittering rather than as a value changing.

          Three states, one ladder of brightness, and the brightness is what distinguishes them
          rather than the `+`. `15m` and `+15m` are one character apart and the lag is usually
          *equal* to a cadence, so those digits genuinely coincide — leaning on the sign alone
          would put the whole distinction on the character least likely to be read. */}
      <span
        className={`relative inline-block w-8 shrink-0 pl-1.5 tabular-nums ${
          focused
            ? // The grid itself. The cursor steps on the focused country's cadence, so this row
              // *is* the grain — stated at its source rather than restated on a row above.
              "font-semibold text-white"
            : lagMinutes > 0
            ? // Off-grid right now: this country's reading is for a different instant than the
              // focused one. Brighter than its resting state, so the eye lands on the row that
              // has something to say.
              "text-ocf-gray-300"
            : // In step. Its own cadence, dimmed — not a placeholder but a fact, and the one
              // that makes the column predictive: any row whose number is larger than the bold
              // one is a row that can drift off the grid. Equal or smaller never can.
              "text-ocf-gray-600"
        }`}
        title={
          focused
            ? `The cursor steps on ${code}'s ${cadenceMinutes}-minute grid. Changing the focused country changes the step.`
            : lagMinutes > 0
            ? `${code} publishes every ${cadenceMinutes} minutes, so its slot is ${lagMinutes} minutes ahead of the cursor — this reading is for a different instant.`
            : `${code} publishes every ${cadenceMinutes} minutes and is on the cursor's grid.`
        }
      >
        {/* The sign hangs in the `pl-1.5` strip rather than sitting in the flow, so the digits
            begin at the same x whether or not there is one. Otherwise the whole number shifts
            right by a character the moment a row goes off-grid, and a column whose job is to be
            scanned vertically would jump sideways exactly when it changed. It stays a real text
            node in reading order, so the cell still reads as "+15m". */}
        {!focused && lagMinutes > 0 && <span className="absolute left-0">+</span>}
        {!focused && lagMinutes > 0 ? `${lagMinutes}m` : `${cadenceMinutes}m`}
      </span>
    </span>
  );
};

const CursorReadout: FC = () => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const enabledCountries = useEnabledCountries();
  const focusedCountry = useFocusedCountry();
  const rangeData = useCursorRange();

  if (!selectedISOTime) return null;

  const focusedZone = getCountryConfig(focusedCountry)?.timezone ?? DEFAULT_TIMEZONE;
  const utc = formatISODateStringAsZonedTime(selectedISOTime, "UTC");

  /**
   * The stack runs in the registry's order — the same order the header toggle and the chart's
   * country picker use, so a user reading down one list and across another sees the same
   * sequence. `config/countries.ts` owns it.
   *
   * This was sorted by each country's actual UTC offset at the cursor's instant, which reads
   * west to east and is the natural order *here*. It is the wrong rule to share, though: an
   * offset-derived order silently reorders itself at DST, and consistency across the three
   * surfaces is worth more than a footer-specific nicety. They agree today anyway — the
   * registry reads GB then NL, which is also west to east.
   */
  const zoneOrder = sortCountryCodes(enabledCountries, (code) => code);

  return (
    <footer
      aria-label="Time cursor"
      className="flex flex-none items-center gap-3 border-t border-white/10 bg-black px-4 py-2 text-xs text-ocf-gray-300"
    >
      {/*
       * A stack of zones, not a sentence about the cursor.
       *
       * This was a wrapping row of labelled phrases — "CURSOR 18:15 UTC", "15-minute steps",
       * then each country. Three problems, all of which this shape answers: it explained more
       * than it showed; "cursor" named the thing the whole footer already is; and because the
       * focused country was filtered out of the list, changing focus *reordered* the row, so
       * the one moment you most want a stable reference was the moment it moved.
       *
       * Every zone now holds the same slot on every render — UTC first as the canonical
       * instant, then each enabled country in the enabled set's own order, focused or not.
       * Focus is a *weight* change (bright, yellow code) rather than a membership change, so a
       * focus switch reads as emphasis moving down a stable list. Every cell is fixed-width
       * and tabular, so nothing reflows as the digits or the lag marker change.
       */}
      <div className="flex flex-none flex-col justify-center gap-px leading-none">
        <span className="flex items-baseline gap-1.5 text-2xs text-ocf-gray-600">
          <span className="w-5 shrink-0 font-bold uppercase tracking-wider">utc</span>
          <span className="w-10 shrink-0 tabular-nums">{utc}</span>
          {/* No grid cell on this row. UTC has no cadence of its own — it is the cursor's
              canonical instant, not a publisher — and the grain is already stated where it comes
              from, in bold on the focused country's row below. An empty cell here would be the
              one genuinely dead space left in the column. */}
        </span>
        {zoneOrder.map((code) => (
          <CountrySlot
            key={code}
            code={code}
            cursor={selectedISOTime}
            focused={code === focusedCountry}
          />
        ))}
      </div>
      {/* Playback, alone now. The grain used to sit here, grouped with it on the grounds that
          both are about *how* the cursor moves (Track P). It moved into the zone stack's third
          column instead: the grain and the per-country lag are the same subject — the cursor's
          grid, and who is off it — so they share one column rather than sitting apart with the
          lag's reserved width reading as a gap between them. What is left here is one control,
          which needs no group of its own.

          Playback is fed from this component's own `useCursorRange()` call rather than
          `ScrubTrack`'s — same hook, same SWR cache key, so the values agree; not rendered
          until that data exists, same as the track itself. */}
      {/* `self-start` lines the button up with the *track*, not with the track plus its axis
          labels. `ScrubTrack` is the tallest thing in this row, so the row's top edge is its top
          edge — and its first 28px are the strip's hit box (`py-1` around an `h-5` strip), which
          is exactly the button's own `h-7`. Two 28px boxes sharing a top edge share a centre, so
          the button reads as being on the strip's line with no nudge to keep in step. Centring
          it instead measured it against the full 48px block and sat it visibly low, level with
          the gap between the strip and the tick labels. */}
      {rangeData && (
        <div className="flex flex-none self-start">
          <PlayButton startTime={rangeData.range.start} endTime={rangeData.range.end} />
        </div>
      )}
      <div className="min-w-[140px] flex-1">
        <ScrubTrack zone={focusedZone} />
      </div>
    </footer>
  );
};

export default CursorReadout;
