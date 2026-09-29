import { ProductStatus, StatusLevel } from "../types";
import { productLabel } from "../../config/statusProducts";
import { orderStatuses } from "../hooks/useStatus";
import { statusDismissalId, useDismissedStatuses } from "../hooks/useDismissedStatuses";
import { CrossInlineSmall } from "../icons/icons";

interface StatusBannerProps {
  statuses: ProductStatus[];
}

/**
 * Per-level presentation. Full class strings, not interpolated fragments, so Tailwind's
 * scanner actually sees them.
 *
 * The rows share one sunken background and are separated by a coloured left edge rather than
 * by a coloured fill: with several stacked at the top of the dashboard, full-bleed
 * severity colours read as an alert wall and swamp the chart below.
 */
const LEVEL_STYLES: Record<Exclude<StatusLevel, "ok">, { emoji: string; accent: string }> = {
  error: { emoji: "🚨", accent: "border-status-alert" },
  warning: { emoji: "⚠️", accent: "border-status-warn" },
  // A check that cannot report on itself is worth surfacing, quietly — a grey edge says
  // "we don't know" without claiming something is broken.
  unknown: { emoji: "❓", accent: "border-content-muted" },
  // A deliberate notice with nothing degraded — planned maintenance, a heads-up. Reusing the
  // warning colour would cry wolf. There is no informational role colour yet, so this is the
  // brighter neutral, set apart from `unknown` by tone alone.
  info: { emoji: "ℹ️", accent: "border-content-secondary" }
};

const StatusBanner = ({ statuses }: StatusBannerProps) => {
  const { isDismissed, dismiss } = useDismissedStatuses();

  const ordered = orderStatuses(statuses);
  const visible = ordered.filter((status) => !isDismissed(status));

  if (!visible.length) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {visible.map((status) => {
        const { emoji, accent } = LEVEL_STYLES[status.status as Exclude<StatusLevel, "ok">];

        return (
          <div
            key={statusDismissalId(status)}
            className={`flex items-center gap-3 border-l-4 bg-surface-sunken px-4 py-2 text-content-secondary ${accent}`}
          >
            {/* Left-aligned, not centred like the old single banner: the severity colour is
                carried by the left edge, and a message centred half a screen away from it does
                not read as belonging to it. */}
            <p className="flex-1">
              {emoji}&nbsp;
              {/* Always named, even when it is the only row. The message text alone cannot be
                  trusted to say which product it is about — "issues with the forecast" reads as
                  *your* forecast — so an unlabelled row can misattribute another country's
                  incident. Labelling unconditionally also avoids reintroducing a dependency on
                  the current view, which is what the old banner switched on. */}
              <span className="font-semibold">{productLabel(status.key, status.name)}: </span>
              {status.message}
            </p>
            <button
              type="button"
              onClick={() => dismiss(status)}
              className="shrink-0 p-1 text-content-muted hover:text-content-secondary"
              aria-label={`Dismiss ${productLabel(status.key, status.name)} status message`}
            >
              <CrossInlineSmall title="Dismiss" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default StatusBanner;
