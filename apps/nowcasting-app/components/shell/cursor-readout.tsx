import { FC } from "react";

import useGlobalState from "../helpers/globalState";
import { useEnabledCountries, useFocusedCountry } from "../../hooks/data";
import { getCountryConfig, sortCountryCodes } from "../../config/countries";
// `periodForInstant`, not `slotForInstant`: the row states the span the country's slot covers
// rather than the label it goes by, and the two ends come from one call so they cannot disagree
// about which period they bound. Nothing here rounds anything — see `lib/time/cursor.ts`.
import { periodForInstant, slotLabellingFor } from "../../lib/time/cursor";
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
 * - **every enabled country's period**, in its own local time — the span its published slot
 *   covers, not the label that slot goes by. The focused country appears here too; focus is a
 *   weight change rather than a membership change, so the list never reorders under a reader.
 *
 * **Why a period and not a timestamp.** The data provider confirmed that NED labels the *start*
 * of NL's period where PV Live labels the *end* of GB's (`config/countries.ts`,
 * `slotLabelling`). A bare `18:00` on two rows is therefore two different quarter- or
 * half-hours of the day, and there is nothing on screen that could tell a reader which. Stating
 * the span says it without requiring the convention to be known first:
 *
 * ```
 *   cursor 17:20 UTC · GB publishes every 30m labelled at the end, NL every 15m at the start
 *
 *     UTC 17:20
 *     GB  18:00–18:30   (17:00-17:30 UTC — the period ENDS at GB's 17:30 label)
 *     NL  19:15–19:30   (17:15-17:30 UTC — the period STARTS at NL's 17:15 label)
 * ```
 *
 * Reading down the column, GB's span closes on its label and NL's opens on it. That is the
 * whole convention, taught by showing rather than by explaining, and this footer is the app's
 * one place where both conventions sit side by side.
 *
 * **The cadence/lag column went, and it went obsolete rather than merely redundant.** It used
 * to hold each row's own cadence, swapped for a `+15m` offset when that country's slot sat
 * ahead of the cursor. Both facts existed *because* a bare timestamp is ambiguous about which
 * interval it names: the lag was the only way to say "this row is not describing the instant
 * you think it is", and the cadence was there to make the lag predictable. A period answers
 * both directly — every row's span contains the cursor by construction (`periodForInstant`), so
 * there is no lag left to report, and the length of the span states the cadence literally
 * instead of numerically. Keeping the column would have restated in digits what the span
 * already shows in full.
 *
 * The UTC row keeps a single instant rather than a span: it is the cursor's canonical value,
 * not a publisher's period, and it is the one thing on screen with no convention attached.
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
  const zone = config?.timezone ?? DEFAULT_TIMEZONE;
  // The span, from one call, so its two ends cannot come from different periods.
  const period = periodForInstant(cursor, code);
  // The country's *timezone*, but not its locale: NL's period is shown at NL's wall clock,
  // written the GB way. `config.locale` ("nl-NL") stays in the registry for when a per-user
  // display preference lands — until then every date and time in the app reads the same,
  // rather than switching convention halfway along a row. See `lib/time/display.ts`.
  const at = (instant: string) => formatISODateStringAsZonedTime(instant, zone, DEFAULT_LOCALE);
  // An en dash, not a hyphen: it is a range, and at this size the hyphen reads as part of the
  // digits either side of it.
  const span = `${at(period.start)}–${at(period.end)}`;
  // Which end of the span the country's own timestamp names. Read from the registry, not
  // inferred from the numbers — the whole point is that the two are impossible to tell apart
  // by eye, which is why the title says it in words.
  const labelsStart = slotLabellingFor(code) === "period-start";

  return (
    <span
      className="flex items-baseline gap-1.5 text-2xs"
      title={`${code} published period, ${zone} — ${code} timestamps label the ${
        labelsStart ? "start" : "end"
      } of their period, so this one is ${code}'s ${
        labelsStart ? at(period.start) : at(period.end)
      }${focused ? ". The cursor's grid and the axis follow this country" : ""}`}
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
      {/* One cell for the whole span, fixed at the width of `00:00–00:00` in tabular figures, so
          a row that steps from a two-digit hour to a one-digit one — or from a 30-minute span to
          a 15-minute one when focus moves — holds exactly the same box. The column is read
          vertically; nothing in it may shift sideways at the moment it changes. */}
      <span
        className={`w-[4.5rem] shrink-0 tabular-nums ${
          focused ? "text-white" : "text-ocf-gray-400"
        }`}
      >
        {span}
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
       * and tabular, so nothing reflows as the cursor steps and the periods change under it.
       */}
      <div className="flex flex-none flex-col justify-center gap-px leading-none">
        <span className="flex items-baseline gap-1.5 text-2xs text-ocf-gray-600">
          <span className="w-5 shrink-0 font-bold uppercase tracking-wider">utc</span>
          {/* One instant, not a span, and deliberately narrower than the rows below it: UTC is
              the cursor's canonical value rather than any publisher's period, so it has no start
              and end to state. It sits at the same left edge as every span below, which is what
              lets the eye check each period against it. */}
          <span className="w-10 shrink-0 tabular-nums">{utc}</span>
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
      {/* Playback, alone. The grain used to sit here, grouped with it on the grounds that both
          are about *how* the cursor moves (Track P); it then moved into the stack as a cadence
          column, and that column has since gone entirely — each row's period is a cadence long,
          so the step is stated by the spans themselves. What is left here is one control, which
          needs no group of its own.

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
