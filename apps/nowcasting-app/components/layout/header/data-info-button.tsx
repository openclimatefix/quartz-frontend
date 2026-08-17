import { useRouter } from "next/router";

import { ChartInfo } from "../../../ChartInfo";
import { InfoIcon } from "../../icons/icons";
import Tooltip from "../../tooltip";
import { useCountryFormatting } from "../../../hooks/data/use-country-format";
import { useFocusedCountry } from "../../../hooks/data";

/**
 * "How to read this dashboard" — the (i).
 *
 * It used to hang off the floating chart's right edge, and was named for the chart
 * (`ChartInfo`) because that is where it started. Its content had drifted well past that: of
 * its five bullets, the timezone and settlement-period conventions ("17:00 means 16:30–17:00")
 * govern the footer's scrub track as much as the chart, the satellite-timing note is about the
 * *map*, and the last is a link to the product docs. One bullet — the Y axis units — is
 * actually chart-specific.
 *
 * So it is app-level reading conventions, and it moved here when the floating chart moved to
 * the top of the stage and the resize handle claimed the corner it had been sitting in. The
 * header is where app-level affordances live, and it is visible whatever the chart is doing —
 * whether it has been dragged small, which mode it is in, whether the display rail is open —
 * which matters most for the reader this exists for: someone reading 17:00 the wrong way and
 * not yet knowing they have a question.
 *
 * **Forecast route only.** The header renders on `/sites` too, where PV_Live, GSPs and the
 * satellite layer are not what is on screen — that copy would be actively wrong there. This
 * keeps the (i) exactly the reach it had while it lived on the forecast chart; giving the sites
 * view its own conventions is a separate piece of writing, not a placement change.
 */
const DataInfoButton: React.FC = () => {
  const { timezone } = useCountryFormatting();
  const focusedCountry = useFocusedCountry();
  const { pathname } = useRouter();
  if (pathname !== "/") return null;

  return (
    <Tooltip
      tip={
        <div className="w-64 rounded-md text-left">
          {/* The focused country, so the period convention stated here is the one governing
              the numbers on screen — GB closes its periods, NL opens them. */}
          <ChartInfo timezone={timezone} country={focusedCountry} />
        </div>
      }
      // Opens down and to the left. The header is the top edge of the page, so there is nothing
      // above it to open into, and it is flush right, so there is nothing to the right either.
      position="left"
    >
      <button
        type="button"
        aria-label="How to read this data"
        title="How to read this data"
        className="flex h-8 w-8 items-center justify-center rounded-full text-ocf-gray-300 hover:text-ocf-yellow focus-visible:text-ocf-yellow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ocf-yellow"
      >
        <InfoIcon />
      </button>
    </Tooltip>
  );
};

export default DataInfoButton;
