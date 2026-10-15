import React from "react";
import { getCountryConfig } from "./config/countries";
import { cadenceMinutesFor, slotLabellingFor } from "./lib/time/cursor";
import { DEFAULT_TIMEZONE } from "./components/helpers/utils";

/**
 * "How to read this dashboard" — the body of the (i).
 *
 * The period convention used to be stated as a GB fact in prose: "following PV_Live, datetimes
 * show the end of the settlement period. For example, 17:00 refers to solar generation between
 * 16:30 to 17:00." That was true of every country in the app until NED was confirmed to label
 * the *start* of NL's periods, at which point this copy was telling Dutch readers the exact
 * opposite of what their numbers meant — the one bullet whose whole job is to stop someone
 * misreading a time was the one actively teaching the misreading.
 *
 * So the sentence is now derived from the same registry fields the arithmetic uses
 * (`slotLabelling`, `cadenceMinutes`), and the worked example is generated rather than written
 * down. A country cannot be added with a convention this text contradicts, because there is no
 * longer any text to contradict it — which is the point, and why this is derivation rather than
 * a second copy of the fact.
 *
 * Attribution is a registry field too (`publisher`), so PV_Live is named for GB and nothing is
 * named for a country that has not confirmed one. Borrowing GB's source for another country's
 * numbers would be a worse error than the wording it replaced.
 */
type ChartInfoProps = {
  timezone?: string;
  /** The country whose conventions to state. Falls back to the registry defaults if absent. */
  country?: string;
};

/** Minutes past midnight → `HH:MM`, for the worked example only. */
const clock = (minutes: number): string => {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(
    2,
    "0"
  )}`;
};

/**
 * The worked example, built from the country's own cadence and labelling.
 *
 * 17:00 is an arbitrary anchor and deliberately not a real instant — it is a clock face, so no
 * timezone or DST reasoning applies to it. The period is laid out on whichever side of the
 * label the country's convention puts it.
 */
const workedExample = (country: string | undefined) => {
  const cadence = cadenceMinutesFor(country);
  const labelsStart = slotLabellingFor(country) === "period-start";
  const anchor = 17 * 60;

  return {
    labelsStart,
    label: clock(anchor),
    from: clock(labelsStart ? anchor : anchor - cadence),
    to: clock(labelsStart ? anchor + cadence : anchor),
    // Half a period, for the satellite note. Whole minutes for every cadence in use.
    halfCadence: cadence / 2
  };
};

export const ChartInfo: React.FC<ChartInfoProps> = ({ timezone = DEFAULT_TIMEZONE, country }) => {
  const publisher = getCountryConfig(country)?.publisher ?? null;
  const { labelsStart, label, from, to, halfCadence } = workedExample(country);

  return (
    <div className="text-left p-1 text-sm mb-1 cursor-default">
      <ul className="list-none space-y-2">
        <li>All datetimes are in {timezone} timezone.</li>
        <li>
          {publisher && (
            <>
              Following{" "}
              <span className="underline font-bold">
                <a href={publisher.url} target="_blank" rel="noreferrer">
                  {publisher.name}
                </a>
              </span>
              ,{" "}
            </>
          )}
          datetimes show the <span className="font-bold">{labelsStart ? "start" : "end"}</span> of
          the period each value covers. <br />
          For example, {label} refers to solar generation between {from} and {to}.
        </li>
        <li>The Y axis units are in MW for the National and GSP charts.</li>
        <li>
          Satellite image shown is from the middle of the period ({halfCadence} min earlier) to
          match the forecast window.
        </li>
        <br />
        <li>
          To learn more, please see our{" "}
          <span className="underline font-bold">
            <a
              href="https://openclimatefix.notion.site/How-to-use-the-Quartz-Solar-site-053005e5db144f6dbd7a3d0fe108d7f2"
              target="_blank"
              rel="noreferrer"
            >
              documentation
            </a>
          </span>
          .
        </li>
      </ul>
    </div>
  );
};
