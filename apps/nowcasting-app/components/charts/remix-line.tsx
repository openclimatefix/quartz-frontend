import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Rectangle,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  convertToLocaleDateString,
  dateToZonedDateTimeString,
  formatISODateString,
  formatISODateStringAsZonedTime,
  formatISODateStringHumanNumbersOnly,
  getRoundedTickBoundary,
  prettyPrintChartAxisLabelDate
} from "../helpers/utils";
import { useCountryFormatting } from "../../hooks/data/use-country-format";
import { useFocusedCountry } from "../../hooks/data/use-countries";
import { periodForLabel } from "../../lib/time/cursor";
import { theme } from "../../tailwind.config";
import useGlobalState, { useCountryState, getCursorNow } from "../helpers/globalState";
import { DELTA_BUCKET } from "../../constant";
import { getZoomYMax } from "../helpers/chartUtils";
import { useTokens } from "../helpers/colour";
import { selectAxisTicks, TickDensity } from "../../lib/time/ticks";
import { ZoomOutIcon } from "@heroicons/react/solid";

const yellow = theme.extend.colors.solar.DEFAULT;
const orange = theme.extend.colors.series.nHour;
const ecmwfOnly = theme.extend.colors.series.ecmwf;
const metOfficeOnly = theme.extend.colors.series.metOffice;
const satOnly = theme.extend.colors.series.satellite;
const pvnetDayAhead = theme.extend.colors["ocf-delta"]["100"];
const pvnetIntraday = theme.extend.colors["ocf-teal"]["600"];
const seasonal = theme.extend.colors.series.seasonal;
const deltaNeg = theme.extend.colors["ocf-delta"]["100"];
const deltaPos = theme.extend.colors["ocf-delta"]["900"];

// Matter SemiMono is the brand's face for values. Recharts writes its ticks and axis labels
// as SVG attributes rather than classed elements, so they cannot take `font-mono` and name
// the variable directly instead. Everything numeric in the chart chrome — axes, tooltip
// figures, the cursor pill — uses it, so the chart agrees with the readouts around it.
const MONO = "var(--font-matter-semi-mono)";
// Target combined opacity for overlapping p-level bands, independent of band count.
const P_LEVEL_BAND_COMBINED_OPACITY = 0.4;
const deltaMaxTicks = [2000, 2500, 3000, 3500, 4000, 4500, 5000];
export type SeasonalQuantile = `P${string}`;
export type SeasonalPValue = { [K in SeasonalQuantile]?: number };
export type SeasonalScalars = {
  [K in `SEASONAL_${SeasonalQuantile}`]?: number;
};

export type SeasonalBound = {
  [K in `SEASONAL_BOUND_${SeasonalQuantile}_${SeasonalQuantile}`]?: number[];
};

// Key for a single p-level band's [min, max] range in ChartData, e.g. "PROBABILISTIC_RANGE_10_90".
export type PLevelRangeKey = `PROBABILISTIC_RANGE_${number}_${number}`;
export type PLevelBounds = { [K in PLevelRangeKey]?: number[] };
export const getPLevelRangeKey = (lower: number, upper: number): PLevelRangeKey =>
  `PROBABILISTIC_RANGE_${lower}_${upper}`;

export type ChartDataBase = {
  formattedDate: string; // "2022-05-16T15:00",

  GENERATION_UPDATED?: number;
  GENERATION?: number;

  FORECAST?: number;
  PAST_FORECAST?: number;
  N_HOUR_FORECAST?: number;
  N_HOUR_PAST_FORECAST?: number;

  INTRADAY_ECMWF_ONLY?: number;
  PAST_INTRADAY_ECMWF_ONLY?: number;
  MET_OFFICE_ONLY?: number;
  PAST_MET_OFFICE_ONLY?: number;
  SAT_ONLY?: number;

  DELTA?: number;
  DELTA_BUCKET?: DELTA_BUCKET;

  // PROBABILISTIC_UPPER_BOUND is used by getZoomYMax to fit the bands
  PROBABILISTIC_UPPER_BOUND?: number;

  SEASONAL_MEAN?: number | undefined;
  SEASONAL_BOUNDS?: string[][] | undefined;
};
export type ChartData = ChartDataBase & SeasonalScalars & SeasonalBound & PLevelBounds;

const toolTiplabels: Record<string, string> = {
  GENERATION: "PV Live estimate",
  GENERATION_UPDATED: "PV Live Actual",
  FORECAST: "Current",
  PAST_FORECAST: "Current",
  INTRADAY_ECMWF_ONLY: "ECMWF-only",
  PAST_INTRADAY_ECMWF_ONLY: "ECMWF-only",
  MET_OFFICE_ONLY: "Met Office-only",
  PAST_MET_OFFICE_ONLY: "Met Office-only",
  SAT_ONLY: "Satellite-only",
  PAST_SAT_ONLY: "Satellite-only",
  N_HOUR_FORECAST: `N-hour`,
  N_HOUR_PAST_FORECAST: "N-hour",
  DELTA: "Delta",
  SEASONAL_P90: "Seasonal P90",
  SEASONAL_MEAN: "Seasonal Mean",
  SEASONAL_P10: "Seasonal P10"
};

const toolTipColors: Record<string, string> = {
  // The actual is the lighter half of the solar pair — same hue as the forecast it is
  // being compared against, which is the brand's "mono-coloured comparative graph".
  GENERATION_UPDATED: theme.extend.colors.solar.light,
  GENERATION: theme.extend.colors.solar.light,
  FORECAST: yellow,
  PAST_FORECAST: yellow,
  INTRADAY_ECMWF_ONLY: ecmwfOnly,
  PAST_INTRADAY_ECMWF_ONLY: ecmwfOnly,
  MET_OFFICE_ONLY: metOfficeOnly,
  PAST_MET_OFFICE_ONLY: metOfficeOnly,
  SAT_ONLY: satOnly,
  PAST_SAT_ONLY: satOnly,
  N_HOUR_FORECAST: orange,
  N_HOUR_PAST_FORECAST: orange,
  DELTA: deltaPos,
  SEASONAL_P90: seasonal,
  SEASONAL_MEAN: seasonal,
  SEASONAL_P10: seasonal
};
type RemixLineProps = {
  timeOfInterest: string;
  data: ChartData[];
  setTimeOfInterest?: (t: string) => void;
  yMax: number | string;
  timeNow: string;
  resetTime?: () => void;
  visibleLines: string[];
  zoomEnabled?: boolean;
  deltaView?: boolean;
  deltaYMaxOverride?: number;
  yTicks?: number[];
};
/**
 * The handle on a reference line — the draggable cursor's time, and the LIVE marker you click to
 * return to now.
 *
 * Both are **controls**, so they wear `--interactive`. They used to wear `solar`, which
 * says "this is the PV forecast" about a thing that is not data at all — the loose end
 * `docs/colour-rationalisation.md` leaves open under "one honest wrinkle in (a)". Settled here in
 * favour of treating them as controls, which is what they are.
 *
 * Two states, one escalation, no second colour:
 * One appearance, no states: a dark body, an oat edge, oat lettering, comfortably WCAG AA
 * against the plot well.
 *
 * It briefly carried an "on the live instant" variant — first as a filled chip, then as white
 * lettering. Both are gone. The fill was far too heavy a block at this size, and the white
 * variant was too quiet to be worth the second rule; the footer's pulsing dot carries
 * following-mode, so the chip was saying a third time what two other things already said.
 *
 * **LIVE no longer hides when the cursor reaches it.** It used to, because the cursor was a 2px
 * line and two lines at one x is a mess. The cursor is a band now, so LIVE is a boundary drawn
 * across it and there is nothing to collide with — and a marker that vanishes exactly when you
 * arrive at it takes away the confirmation that you did.
 *
 * The body is `surface`, not black-black: on a `#141515` plot well a true black chip has no edge
 * of its own, and the hairline is what gives it one.
 */
const CustomizedLabel: FC<any> = ({
  value,
  offset,
  viewBox: { x },
  className,
  solidLine,
  onClick,
  onGrab,
  grip
}) => {
  const yy = 10;
  const pillWidth = Math.max(40, String(value ?? "").length * 7.2 + 14);

  /* MOCK (uncommitted): the grip-only cursor.
     The period label moves out of the chart and lives once, in the footer, tethered to the
     scrub handle. What stays here is the control itself, drawn as the *same object* the footer
     draws — `scrub-track.tsx`'s handle is a 5x26 `bg-interactive` capsule with a dark ring, and
     that file's own comment says the two "only teach that by looking like one object". So this
     is that capsule, in SVG units, at the top of the cursor's line.
     The line under it is the ReferenceLine's own stroke, so no stub is drawn here. */
  if (grip) {
    return (
      <g
        className={className || ""}
        style={{ pointerEvents: "all" }}
        onMouseDown={(e) => {
          if (!onGrab) return;
          e.stopPropagation();
          onGrab();
        }}
        onMouseUp={(e) => {
          if (!onGrab) return;
          e.stopPropagation();
        }}
      >
        {/* A 5px-wide target is not grabbable with a mouse, let alone a trackpad. */}
        <rect x={x - 9} y={yy - 5} width={18} height={36} fill="transparent" />
        <rect
          x={x - 2.5}
          y={yy}
          width={5}
          height={26}
          rx={2.5}
          className="fill-interactive"
          stroke="rgba(0,0,0,0.7)"
          strokeWidth={1.5}
        />
      </g>
    );
  }

  return (
    <g>
      <line
        className={solidLine ? "stroke-interactive" : "stroke-content"}
        strokeWidth={solidLine ? "2" : "1"}
        strokeDasharray={solidLine ? "" : "3 3"}
        fill="none"
        fillOpacity="1"
        x1={x}
        y1={yy + 30}
        x2={x}
        y2={yy}
      ></line>
      {/*
        Recharts binds click, mousedown, mousemove and mouseup on the chart itself — mousedown
        opens a zoom selection and mouseup commits `setTimeOfInterest` to wherever the pointer
        was. A label handler alone therefore lost every race: LIVE's `resetTime` ran and was
        immediately overwritten by the chart's own mouseup. So the group stops the pointer here
        rather than trying to out-order it.
      */}
      <g
        className={className || ""}
        style={{ pointerEvents: "all" }}
        onMouseDown={(e) => {
          if (!onClick && !onGrab) return;
          e.stopPropagation();
          onGrab?.();
        }}
        onMouseUp={(e) => {
          if (!onClick && !onGrab) return;
          e.stopPropagation();
        }}
        onClick={(e) => {
          if (!onClick) return;
          e.stopPropagation();
          onClick();
        }}
      >
        {/* Sized from the text rather than a constant 40. The pill used to hold one time
            ("10:00"); it now holds a period ("09:30–10:00"), and a fixed rect either clipped the
            span or left a hole around a short label. 7.2px is the advance width of Matter Semi
            Mono at `text-xs` — it is a monospace face, so a character count is an exact
            measurement here, not an estimate. */}
        <rect
          x={x - pillWidth / 2}
          y={yy}
          width={pillWidth}
          height="20"
          rx="4"
          offset={offset}
          className="fill-surface stroke-interactive"
          strokeWidth="1"
        ></rect>
        <text
          x={x}
          y={yy + 14}
          className="fill-interactive font-mono font-medium tabular-nums text-xs"
          id="time-now"
          textAnchor="middle"
        >
          {value}
        </text>
      </g>
    </g>
  );
};

const DateLabel: FC<any> = ({ value, offset, viewBox: { x }, className, solidLine, onClick }) => {
  const yy = -9;
  return (
    <g>
      <g className={`fill-content ${className || ""}`} onClick={onClick}>
        <rect x={x - 24} y={yy} width="48" height="21" offset={offset} fill={"inherit"}></rect>
        <text
          x={x}
          y={yy + 15}
          className="fill-surface font-mono tabular-nums text-xs"
          id="time-now"
          textAnchor="middle"
        >
          {value}
        </text>
      </g>
    </g>
  );
};

const RemixLine: React.FC<RemixLineProps> = ({
  timeOfInterest,
  data,
  setTimeOfInterest,
  yMax,
  timeNow,
  resetTime,
  visibleLines,
  zoomEnabled = true,
  deltaView = false,
  deltaYMaxOverride,
  yTicks
}) => {
  // Set the y max. If national then set to 12000, for gsp plot use 'auto'
  const preppedData = data.sort((a, b) => a.formattedDate.localeCompare(b.formattedDate));
  // Plot furniture resolved from the role tokens rather than imported as literals, so the
  // chart's own surfaces follow the theme the way the rest of the app does. Fallbacks are the
  // dark values — the default theme — so the server render matches and nothing flashes.
  // Dark values as the fallbacks — dark is the default theme, so the server render and the
  // first client frame match it and nothing flashes. Recharts takes these as attribute values,
  // so they must be real colours: a `rgb(var(--x) / <alpha-value>)` template is invalid CSS and
  // is dropped without an error.
  const plot = useTokens({
    bandA: { name: "--plot-band-a", alpha: 0.3, fallback: "rgb(12 13 13 / 0.3)" },
    bandB: { name: "--plot-band-b", alpha: 0.3, fallback: "rgb(20 21 21 / 0.3)" },
    stroke: { name: "--content", alpha: 0.1, fallback: "rgb(255 255 255 / 0.1)" },
    // Axis ticks, axis labels and the reference lines. Chrome, not data — so it follows the
    // theme rather than sitting at a fixed white.
    axis: { name: "--content", alpha: 1, fallback: "rgb(255 255 255)" },
    // The cursor's own line, in the interactive colour — the same token the pill around it and
    // the scrub handle wear, so the three read as one object. That token is oat now, which is
    // close to the LIVE line's white; the two are told apart by solid-versus-dashed and by the
    // pill, which is how they were told apart before the orange went anyway.
    cursor: { name: "--interactive", alpha: 1, fallback: "rgb(255 251 245)" }
  });

  const [showNHourView] = useGlobalState("showNHourView");
  const [isSitesChart] = useGlobalState("isSitesChart");
  const [largeScreenMode] = useGlobalState("dashboardMode");
  // The "now" reference line, on the cursor grid — it is compared against `timeOfInterest`,
  // which is the cursor, so the two have to be rounded the same way. The helper this replaced
  // read `getMinutes()` off a local-zone `Date`, which also only worked by cancellation.
  const currentTime = getCursorNow().slice(0, 16);

  /**
   * Dragging the cursor pill.
   *
   * The position comes from Recharts' own `activeLabel` on the chart's `onMouseMove` rather
   * than from pixel maths: the x axis is a *category* scale, so there is no scale to invert —
   * `activeLabel` is already the nearest category, which is the snapping behaviour wanted.
   *
   * A ref beside the state because the chart's handlers are closures Recharts re-invokes at
   * pointer rate; reading the state there would read the value from the render that installed
   * them. The state is only there to drive the cursor style.
   */
  const [draggingCursor, setDraggingCursor] = useState(false);
  const draggingCursorRef = useRef(false);
  const beginCursorDrag = () => {
    draggingCursorRef.current = true;
    setDraggingCursor(true);
  };
  // On `window`, not on the chart: releasing outside the plot is the common case at the ends of
  // the range, and a drag that never ends leaves every later mousemove moving the cursor.
  useEffect(() => {
    if (!draggingCursor) return;
    const end = () => {
      draggingCursorRef.current = false;
      setDraggingCursor(false);
    };
    window.addEventListener("mouseup", end);
    return () => window.removeEventListener("mouseup", end);
  }, [draggingCursor]);

  const commitCursor = (activeLabel?: string) => {
    if (!activeLabel || !setTimeOfInterest) return;
    setTimeOfInterest(
      isSitesChart
        ? new Date(Number(activeLabel))?.toISOString() || new Date().toISOString()
        : activeLabel
    );
  };
  // Deliberately NOT given the country's zone, unlike the display helpers below.
  //
  // This value is not shown to anyone: it is turned into epoch millis and matched against the
  // solar-sites chart's `formattedDate` keys, which `use-format-chart-data-sites.tsx` builds
  // as plain UTC epochs. This is correct in every viewer zone, but only by cancellation, so
  // do not "tidy" it: the conversion shifts the instant into the viewer's zone and stamps a
  // false "Z", then `.slice(0, 16)` strips that "Z" again, so `new Date()` re-reads the value
  // as *local* — and the two shifts cancel exactly.
  //
  // Passing a zone here breaks it (Europe/London is an hour out in BST, America/Los_Angeles
  // seven). The sibling call in solar-site-chart.tsx looks identical but keeps its "Z", so it
  // parses as absolute with nothing to cancel the shift, and genuinely does need "UTC".
  // utils.viewerZone.test.ts pins all three shapes across zones; jest's TZ=UTC hides the
  // whole class otherwise.
  const localeTimeOfInterest = convertToLocaleDateString(timeOfInterest + "Z").slice(0, 16);
  const defaultZoom = { x1: "", x2: "" };
  const [filteredPreppedData, setFilteredPreppedData] = useState(preppedData);
  const [globalZoomArea, setGlobalZoomArea] = useGlobalState("globalZoomArea");
  const [globalIsZooming, setGlobalIsZooming] = useGlobalState("globalChartIsZooming");
  const [globalIsZoomed, setGlobalIsZoomed] = useGlobalState("globalChartIsZoomed");
  const [temporaryZoomArea, setTemporaryZoomArea] = useState(defaultZoom);
  const [nHourForecast] = useGlobalState("nHourForecast");
  const [selectedMapRegionIds] = useCountryState("selectedMapRegionIds");
  const [pLevels] = useGlobalState("pLevels");
  const { timezone, locale } = useCountryFormatting();

  /**
   * The cursor names a *period*, not an instant — GB's 10:00 is the half hour that ended then,
   * NL's is the quarter hour that starts there. The line the user drags stays on the label,
   * because that is the value they are picking; the band behind it is the span that label is
   * about, which is the part the convention hides.
   *
   * `periodForLabel`, **not** `periodForInstant`: what arrives here is already resolved to this
   * country's published label (`pv-remix-chart` runs the cursor through `slotForInstant` before
   * anything is drawn or looked up). Asking the cursor question about a label returns the period
   * *after* the right one on a period-end country — which is how the chart and the scrub bar
   * came to draw two different windows for one cursor.
   *
   * **Both ends are then cut to the axis' category format**, which is not what they arrive in.
   * `periodForLabel` returns full ISO instants (`2026-09-02T13:00:00.000Z`); the axis' categories
   * are `formattedDate`, a 16-character slice (`2026-09-02T13:00`). A category axis matches
   * `x1`/`x2` by exact value and `ifOverflow="hidden"` drops an area whose ends are not in the
   * domain, so full ISO ends silently rendered nothing at all — which is what the band did from
   * the day it was written until this was found. `formatISODateString` is the same cut the axis
   * itself applies, so the two agree by construction rather than by coincidence.
   *
   * Addressing the axis by a boundary only works because a period boundary is always a point
   * this country publishes — the band is one cadence wide by construction.
   */
  const focusedCountry = useFocusedCountry();
  const cursorPeriod = useMemo(() => {
    if (isSitesChart) return null;
    const period = periodForLabel(timeOfInterest, focusedCountry);
    return {
      start: formatISODateString(period.start),
      end: formatISODateString(period.end)
    };
  }, [isSitesChart, timeOfInterest, focusedCountry]);

  /**
   * The period under the pointer — the one a click is about to select.
   *
   * Drawn the same way as `cursorPeriod` and from the same call, so the thing you are about to
   * pick and the thing you have picked are the same shape and cannot drift apart. It is fainter,
   * which is the whole distinction between them: an intention, not a selection.
   *
   * **Held as a label, not as pixels.** A custom Recharts `cursor` element would have to rebuild
   * the period rule in pixel space — a band width, and which side of the point it falls on,
   * which is the country's labelling convention all over again (see `lib/time/cursor.ts`). This
   * asks `periodForLabel` instead, exactly as the selection does.
   *
   * **And it only re-renders once per category.** `onMouseMove` fires per pixel, so the write is
   * guarded on the label actually changing — the same rate Recharts already updates the tooltip
   * at. The ref is what lets the guard read the current value without the handler depending on
   * the state it sets.
   */
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const hoverLabelRef = useRef<string | null>(null);
  const setHoverLabelIfChanged = useCallback((label: string | null) => {
    if (hoverLabelRef.current === label) return;
    hoverLabelRef.current = label;
    setHoverLabel(label);
  }, []);

  const hoverPeriod = useMemo(() => {
    if (isSitesChart || !hoverLabel) return null;
    const period = periodForLabel(hoverLabel, focusedCountry);
    return {
      start: formatISODateString(period.start),
      end: formatISODateString(period.end)
    };
  }, [isSitesChart, hoverLabel, focusedCountry]);

  /**
   * The x axis's tick labels — 6-hourly (00:00/06:00/12:00/18:00) with room, midnight/midday
   * only when there is not. `lib/time/ticks.ts` holds the rule (shared with the scrub track)
   * and the hysteresis that keeps a resize from relabelling every frame; this only measures the
   * chart's own width, which moves independently of the browser window (`CHART_SPLIT`, the
   * display rail, dashboard mode) so a `window.innerWidth` breakpoint would be wrong here.
   *
   * The category axis (national/GSP/delta charts) needs the chosen instants translated back
   * into `formattedDate` strings that actually appear in the data, because Recharts' `ticks`
   * prop on a category axis has to name real category values, not arbitrary points on the
   * timeline. `isSitesChart` uses its own numeric axis below and is untouched here.
   */
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidthPx, setChartWidthPx] = useState(0);
  const previousTickDensityRef = useRef<TickDensity | null>(null);

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setChartWidthPx(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The category axis' domain — whatever is actually plotted, zoomed or not — is what the tick
  // instants have to be found inside and translated back to.
  const displayedChartData = zoomEnabled && globalIsZoomed ? filteredPreppedData : preppedData;

  const categoryTicks = useMemo(() => {
    if (isSitesChart || displayedChartData.length === 0) return undefined;
    const startMs = DateTime.fromISO(displayedChartData[0].formattedDate, {
      zone: "utc"
    }).toMillis();
    const endMs = DateTime.fromISO(
      displayedChartData[displayedChartData.length - 1].formattedDate,
      {
        zone: "utc"
      }
    ).toMillis();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return undefined;

    const selection = selectAxisTicks({
      startMs,
      endMs,
      zone: timezone,
      widthPx: chartWidthPx,
      previousDensity: previousTickDensityRef.current
    });
    previousTickDensityRef.current = selection.density;

    // Only instants the data actually has an entry for can be a Recharts category tick — a
    // 00:00/06:00/etc boundary always lands on a real point (both GB and NL sit on whole-hour
    // UTC offsets, so a local day boundary is always on the cadence grid), but this still guards
    // against a gap or a window that does not reach a boundary.
    const available = new Set(displayedChartData.map((d) => d.formattedDate));
    const keys = selection.ticks
      .map((ms) => DateTime.fromMillis(ms, { zone: "utc" }).toFormat("yyyy-LL-dd'T'HH:mm"))
      .filter((key) => available.has(key));
    return keys.length > 0 ? keys : undefined;
  }, [isSitesChart, displayedChartData, timezone, chartWidthPx]);

  function prettyPrintYNumberWithCommas(
    x: string | number,
    showDecimals: number = 2,
    divisionFactor: number = 1
  ) {
    const xNumber = Number(x) / divisionFactor;
    const isSmallNumber = xNumber !== 0 && (xNumber < 0 ? xNumber > -10 : xNumber < 10);
    const roundedNumber =
      showDecimals > 0 && isSmallNumber ? xNumber.toFixed(showDecimals) : Math.round(xNumber);
    return roundedNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  const CustomBar = (props: { DELTA: number }) => {
    const { DELTA } = props;
    let fill = DELTA > 0 ? deltaPos : deltaNeg;
    return <Rectangle {...props} fill={fill} />;
  };

  const deltaMax = data
    .map((d) => d.DELTA)
    .filter((n) => typeof n === "number")
    .sort((a, b) => Number(b) - Number(a))[0];
  const deltaMin = data
    .map((d) => d.DELTA)
    .filter((n) => typeof n === "number")
    .sort((a, b) => Number(a) - Number(b))[0];

  // Take the max absolute value of the delta min and max as the y-axis max
  const deltaYMax =
    deltaYMaxOverride ||
    getRoundedTickBoundary(Math.max(Number(deltaMax), 0 - Number(deltaMin)) || 0, deltaMaxTicks);

  const roundTickMax = deltaYMax % 1000 === 0;
  const isGSP = !!deltaYMaxOverride && deltaYMaxOverride < 1000;
  const now = new Date();
  const offsets = [-24, -18, -12, -6, 0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60];
  const ticks = offsets.map((o) => {
    return new Date(now).setHours(o, 0, 0, 0);
  });

  /**
   * Axis labels, in the footer's format: `ccc HH:mm` on the first tick of each day, bare
   * `HH:mm` on the rest.
   *
   * This replaces a second axis (`x-axis-3`) that printed the date on its own row beneath the
   * times. That row cost ~18px of plot height and, because it was a separate tick set at a
   * different interval, it repeated a date once per group — "Thu 27" twice, "Today" twice. One
   * row cannot repeat a day, because the day is only printed when it changes.
   *
   * Built as a lookup rather than computed inside the formatter: "has the day changed" is a
   * property of a tick's *position in the sequence*, and Recharts calls the formatter per tick
   * with no reliable ordering guarantee.
   */
  const axisTickLabels = useMemo(() => {
    const source: (string | number)[] | undefined = isSitesChart ? ticks : categoryTicks;
    const labels: Record<string, string> = {};
    if (!source) return labels;
    let previousDay = "";
    for (const value of source) {
      const dt = (
        typeof value === "number"
          ? DateTime.fromMillis(value)
          : DateTime.fromISO(value, { zone: "utc", setZone: true })
      )
        .setZone(timezone)
        .setLocale(locale);
      if (!dt.isValid) continue;
      const day = dt.toFormat("yyyy-LL-dd");
      const showDay = day !== previousDay;
      previousDay = day;
      labels[String(value)] = dt.toFormat(showDay ? "ccc HH:mm" : "HH:mm");
    }
    return labels;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSitesChart, ticks.join(","), categoryTicks?.join(","), timezone, locale]);
  //get Y axis boundary

  const yMaxZoom_Levels = [
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 6000,
    7000, 8000, 9000, 10000, 11000, 12000
  ];

  let zoomYMax = getZoomYMax(filteredPreppedData);
  zoomYMax = getRoundedTickBoundary(zoomYMax || 0, yMaxZoom_Levels);

  //reset zoom state
  function handleZoomOut() {
    setGlobalZoomArea({ x1: "", x2: "" });
    setGlobalIsZoomed(false);
    setFilteredPreppedData(preppedData);
  }

  const updateFilteredData = () => {
    const { x1, x2 } = globalZoomArea;

    if (!x1 || !x2) return;

    const dataInAreaRange = preppedData.filter(
      (d) => d?.formattedDate >= x1 && d?.formattedDate <= x2
    );
    setFilteredPreppedData(dataInAreaRange);
  };

  useEffect(() => {
    if (!zoomEnabled) return;

    if (!globalIsZooming) {
      updateFilteredData();
    }
  }, [globalZoomArea, globalIsZooming, preppedData, zoomEnabled]);

  useEffect(() => {
    updateFilteredData();
  }, [nHourForecast]);

  const DeltaTick: FC<{ x?: number; y?: number; stroke?: string; payload?: any }> = ({
    x,
    y,
    stroke,
    payload
  }) => {
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          className="fill-content font-mono tabular-nums text-xs text-right"
          x={0}
          y={0}
          dy={3}
          textAnchor={"start"}
        >
          {`${payload.value > 0 ? "+" : ""}${prettyPrintYNumberWithCommas(payload.value)}`}
        </text>
      </g>
    );
  };

  let rightChartMargin = 16;
  let deltaLabelOffset = roundTickMax ? -20 : -10;
  if (deltaView) {
    if (selectedMapRegionIds?.length) {
      rightChartMargin = 15;
      if (roundTickMax) {
        deltaLabelOffset = 0;
      } else {
        deltaLabelOffset = -5;
      }
    } else {
      rightChartMargin = 0;
    }
  }
  console.log("chartData", data);
  console.log("DELTA", deltaView);

  return (
    <div ref={chartContainerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {zoomEnabled && globalIsZoomed && (
        <div className={`absolute top-5 z-10 ${deltaView ? `right-16 mr-3` : `right-4`}`}>
          <button
            type="button"
            onClick={handleZoomOut}
            style={{ position: "relative", top: "0", left: "20" }}
            className="flex font-bold items-center p-1.5 border-surface-panel text-content bg-surface-panel hover:bg-content-muted focus:z-10 focus:text-content h-auto"
          >
            <ZoomOutIcon className="w-8 h-8" />
          </button>
        </div>
      )}
      <div className="absolute inset-0">
        <ResponsiveContainer debounce={100}>
          <ComposedChart
            className="select-none"
            width={500}
            height={400}
            data={zoomEnabled && globalIsZoomed ? filteredPreppedData : preppedData}
            margin={{
              top: 20,
              right: rightChartMargin,
              bottom: -4,
              left: 16
            }}
            onClick={(e?: { activeLabel?: string }) => {
              if (draggingCursorRef.current) return;
              if (globalIsZooming) return;

              if (setTimeOfInterest && e?.activeLabel) {
                isSitesChart
                  ? setTimeOfInterest(
                      new Date(Number(e.activeLabel))?.toISOString() || new Date().toISOString()
                    )
                  : setTimeOfInterest(e.activeLabel);
              }
            }}
            onMouseDown={(e?: { activeLabel?: string }) => {
              if (draggingCursorRef.current) return;
              if (!zoomEnabled) return;
              setTemporaryZoomArea(globalZoomArea);
              setGlobalIsZooming(true);
              let xValue = e?.activeLabel;
              if (typeof xValue === "string" && xValue.length > 0) {
                setGlobalZoomArea({ x1: xValue, x2: xValue });
              }
            }}
            onMouseMove={(e?: { activeLabel?: string }) => {
              setHoverLabelIfChanged(e?.activeLabel ?? null);
              // Before the zoom guard: the cursor is draggable whether or not zoom is enabled.
              if (draggingCursorRef.current) {
                commitCursor(e?.activeLabel);
                return;
              }
              if (!zoomEnabled) return;

              if (globalIsZooming) {
                let xValue = e?.activeLabel;
                if (!xValue) return;
                setGlobalZoomArea((zoom) => ({ ...zoom, x2: xValue || "" }));
              }
            }}
            onMouseLeave={() => setHoverLabelIfChanged(null)}
            onMouseUp={(e?: { activeLabel?: string }) => {
              if (draggingCursorRef.current) return;
              if (!zoomEnabled) return;

              if (globalIsZooming) {
                if (
                  globalZoomArea.x1 === globalZoomArea.x2 &&
                  e?.activeLabel &&
                  setTimeOfInterest
                ) {
                  setGlobalZoomArea(temporaryZoomArea);
                  setTimeOfInterest(e?.activeLabel);
                } else if (globalZoomArea?.x1?.length && globalZoomArea?.x2?.length) {
                  let { x1 } = globalZoomArea;
                  let x2 = e?.activeLabel || "";
                  if (x1 > x2) {
                    [x1, x2] = [x2, x1];
                  }
                  setGlobalZoomArea({ x1, x2 });
                  setGlobalIsZoomed(true);
                }
                setGlobalIsZooming(false);
              }
            }}
          >
            <CartesianGrid
              verticalFill={[plot.bandA, plot.bandB]}
              // Alpha lives in the token requests above, not here: a blanket fillOpacity
              // composites the bands against whatever is behind them, so the value you set is
              // never the value you see.
              fillOpacity={1}
              stroke={plot.stroke}
              strokeOpacity={1}
            />
            {/* The tick formatters are wrapped rather than passed by reference because recharts
                calls them with (value, index), and index would land in the timezone argument
                these helpers take. The wrapper is what makes passing the country's zone here
                safe — a bare `tickFormatter={prettyPrintChartAxisLabelDate}` would silently
                format ticks in whatever zone the tick's array index named. */}
            <XAxis
              dataKey="formattedDate"
              xAxisId={"x-axis"}
              tickFormatter={(x) =>
                axisTickLabels[String(x)] ?? prettyPrintChartAxisLabelDate(x, timezone, locale)
              }
              scale={isSitesChart ? "time" : "auto"}
              tick={{ fill: plot.axis, style: { fontSize: "10px", fontFamily: MONO } }}
              tickLine={true}
              // The labels used to sit tight under the rule because a second row carried the
              // date below them and closed the gap. With that row gone they were the last thing
              // on the axis and read as crowding it. `height` grows with the margin so the extra
              // space is inside the axis box rather than clipped off the bottom of it.
              tickMargin={8}
              height={34}
              type={isSitesChart ? "number" : "category"}
              ticks={isSitesChart ? ticks : categoryTicks}
              domain={isSitesChart ? [ticks[0], ticks[ticks.length - 1]] : undefined}
              interval={isSitesChart ? undefined : categoryTicks ? 0 : 11}
            />
            <XAxis
              className="select-none"
              dataKey="formattedDate"
              xAxisId={"x-axis-2"}
              tickFormatter={(x) => prettyPrintChartAxisLabelDate(x, timezone, locale)}
              scale={isSitesChart ? "time" : "auto"}
              tick={{ fill: plot.axis, style: { fontSize: "10px", fontFamily: MONO } }}
              tickLine={true}
              type={isSitesChart ? "number" : "category"}
              ticks={isSitesChart ? ticks : categoryTicks}
              domain={isSitesChart ? [ticks[0], ticks[ticks.length - 1]] : undefined}
              interval={isSitesChart ? undefined : categoryTicks ? 0 : 11}
              orientation="top"
              padding="no-gap"
              hide={true}
            />

            <YAxis
              tickFormatter={
                isSitesChart ? undefined : (val, i) => prettyPrintYNumberWithCommas(val)
              }
              yAxisId={"y-axis"}
              tick={{ fill: plot.axis, style: { fontSize: "10px", fontFamily: MONO } }}
              tickLine={false}
              ticks={yTicks}
              domain={globalIsZoomed && !isSitesChart ? [0, Number(zoomYMax * 1.1)] : [0, yMax]}
              label={{
                value: isSitesChart ? "Generation (KW)" : "Generation (MW)",
                angle: 270,
                position: "outsideLeft",
                fill: plot.axis,
                style: { fontSize: "10px", fontFamily: MONO },
                offset: 0,
                dx: -26,
                dy: 0
              }}
            />

            {deltaView && (
              <>
                <YAxis
                  tickFormatter={(val, i) =>
                    prettyPrintYNumberWithCommas(val, roundTickMax ? 0 : 2)
                  }
                  tick={<DeltaTick />}
                  ticks={[deltaYMax, deltaYMax / 2, 0, -deltaYMax / 2, -deltaYMax]}
                  tickCount={5}
                  tickLine={false}
                  yAxisId={"delta"}
                  scale={"auto"}
                  orientation="right"
                  label={{
                    value: `Delta (MW)`,
                    angle: 90,
                    position: "insideRight",
                    fill: plot.axis,
                    style: { fontSize: "10px", fontFamily: MONO },
                    offset: 0,
                    dx: deltaLabelOffset,
                    dy: 29
                  }}
                  domain={[-deltaYMax, deltaYMax]}
                  padding={{ top: 0, bottom: 0 }}
                />
                <ReferenceLine
                  yAxisId={"delta"}
                  xAxisId={"x-axis"}
                  y={0}
                  stroke={plot.axis}
                  strokeWidth={0.1}
                />
              </>
            )}

            {/* The cursor carries no label and no grip. The period reads once, in the footer,
                tethered to the scrub handle; the grip collided with the LIVE marker, both being
                `--interactive` objects at the top of a reference line. Click-to-set-time
                (`onClick`/`activeLabel` above) is untouched — that is the interaction layout
                contract §4 protects — and dragging is the footer track's job. `beginCursorDrag`
                and `draggingCursor` are unreachable now and come out if this holds up. */}
            {/* The cursor IS the period.
                The 2px line is gone and the band it used to sit inside carries the cursor on its
                own, spanning the whole span the reading covers. A line says "this instant",
                which is not what the cursor means — every value on this chart is an average over
                a settlement period, and the line was drawing one edge of it (which edge depended
                on the country's labelling). The band draws the thing itself.

                Kept low. As the only mark it competes with the series rather than sitting behind
                them, and the two dials are `fillOpacity` (the block) and `strokeOpacity` (its
                edges). The edges are what stop it reading as a smudge — they are where the period
                starts and stops, and at this width that is most of the information. */}
            {/* The period you are about to select. Under half the
                selection's alpha and no edges — edges would make it a second definite mark, and
                this one is provisional. Suppressed while it coincides with the selection, where
                two stacked fills would read as a third, brighter state that means nothing. */}
            {hoverPeriod && hoverPeriod.start !== cursorPeriod?.start && (
              <ReferenceArea
                x1={hoverPeriod.start}
                x2={hoverPeriod.end}
                yAxisId={"y-axis"}
                xAxisId={"x-axis"}
                fill={plot.cursor}
                fillOpacity={0.09}
                strokeWidth={0}
                ifOverflow="hidden"
              />
            )}

            {cursorPeriod ? (
              <ReferenceArea
                x1={cursorPeriod.start}
                x2={cursorPeriod.end}
                yAxisId={"y-axis"}
                xAxisId={"x-axis"}
                fill={plot.cursor}
                fillOpacity={0.22}
                stroke={plot.cursor}
                strokeOpacity={0.45}
                strokeWidth={1}
                ifOverflow="hidden"
              />
            ) : (
              /* No period resolved — the sites chart's numeric axis, or a cursor outside the
                 plotted range. The line is the fallback so the cursor never disappears. */
              <ReferenceLine
                x={isSitesChart ? new Date(localeTimeOfInterest).getTime() : timeOfInterest}
                stroke={plot.cursor}
                strokeOpacity={0.6}
                strokeWidth={2}
                yAxisId={"y-axis"}
                xAxisId={"x-axis"}
                scale={isSitesChart ? "time" : "auto"}
              />
            )}

            {/* LIVE is declared after both bands so it paints over them: reference elements
                render in JSX order with no `z-index` to appeal to, and the bands were covering
                the pill. A period is the ground a boundary is drawn across. */}
            <ReferenceLine
              x={isSitesChart ? new Date(currentTime + ":00.000Z").getTime() : currentTime}
              stroke={plot.axis}
              strokeWidth={1}
              yAxisId={"y-axis"}
              xAxisId={"x-axis"}
              scale={isSitesChart ? "time" : "auto"}
              strokeDasharray="3 3"
              label={
                <CustomizedLabel
                  className="cursor-pointer z-30 text-sm"
                  value={"LIVE"}
                  onClick={resetTime}
                />
              }
            />

            {deltaView && (
              <Bar
                type="monotone"
                dataKey="DELTA"
                yAxisId={"delta"}
                xAxisId={"x-axis"}
                // @ts-ignore
                shape={<CustomBar />}
                barSize={3}
              />
            )}
            {showNHourView && (
              <>
                <Line
                  type="monotone"
                  dataKey="N_HOUR_FORECAST"
                  dot={false}
                  yAxisId={"y-axis"}
                  xAxisId={"x-axis"}
                  strokeDasharray="5 5"
                  strokeDashoffset={3}
                  stroke={orange} // blue
                  strokeWidth={largeScreenMode ? 4 : 1}
                  hide={!visibleLines.includes("N_HOUR_FORECAST")}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="N_HOUR_PAST_FORECAST"
                  dot={false}
                  yAxisId={"y-axis"}
                  xAxisId={"x-axis"}
                  // strokeDasharray="10 10"
                  stroke={orange} // blue
                  strokeWidth={largeScreenMode ? 4 : 1}
                  hide={!visibleLines.includes("N_HOUR_FORECAST")}
                  isAnimationActive={false}
                />
              </>
            )}

            {pLevels.map(([lower, upper]) => (
              <Area
                key={`${lower}-${upper}`}
                type="monotone"
                dataKey={getPLevelRangeKey(lower, upper)}
                dot={false}
                xAxisId={"x-axis"}
                yAxisId={"y-axis"}
                stroke={yellow}
                fill={yellow}
                // Lowers each band's opacity as more bands are added, so overlapping bands always look like P_LEVEL_BAND_COMBINED_OPACITY, not darker.
                fillOpacity={1 - Math.pow(1 - P_LEVEL_BAND_COMBINED_OPACITY, 1 / pLevels.length)}
                strokeWidth={0}
                hide={!visibleLines.includes("FORECAST")}
                isAnimationActive={false}
              />
            ))}

            <Line
              type="monotone"
              dataKey="SEASONAL_MEAN"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              stroke={seasonal}
              fill="transparent"
              fillOpacity={50}
              strokeWidth={largeScreenMode ? 3 : 1}
              hide={!visibleLines.includes("SEASONAL_MEAN")}
              isAnimationActive={false}
            />

            {data.length > 0 &&
              data[0].SEASONAL_BOUNDS?.map((boundPair) => {
                return (
                  <Area
                    key={`SEASONAL_BOUND_${boundPair.join("_")}`}
                    dataKey={`SEASONAL_BOUND_${boundPair.join("_")}`}
                    type="monotone"
                    dot={false}
                    xAxisId={"x-axis"}
                    yAxisId={"y-axis"}
                    stroke={seasonal}
                    fill={seasonal}
                    fillOpacity={
                      (1 /
                        (Number(boundPair[1].replace("P", "")) -
                          Number(boundPair[0].replace("P", "")))) *
                      15
                    }
                    strokeWidth={0}
                    hide={!visibleLines.includes("SEASONAL_BOUNDS")}
                    isAnimationActive={false}
                  />
                );
              })}

            <Line
              type="monotone"
              dataKey="PAST_INTRADAY_ECMWF_ONLY"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              stroke={ecmwfOnly} //yellow
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 1}
              hide={!visibleLines.includes("INTRADAY_ECMWF_ONLY")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="INTRADAY_ECMWF_ONLY"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              strokeDasharray="5 5"
              stroke={ecmwfOnly} //yellow
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 1}
              hide={!visibleLines.includes("INTRADAY_ECMWF_ONLY")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="PAST_SAT_ONLY"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              stroke={satOnly}
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 1}
              hide={!visibleLines.includes("SAT_ONLY")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="SAT_ONLY"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              strokeDasharray="5 5"
              stroke={satOnly}
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 1}
              hide={!visibleLines.includes("SAT_ONLY")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="PAST_MET_OFFICE_ONLY"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              stroke={metOfficeOnly}
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 1}
              hide={!visibleLines.includes("MET_OFFICE_ONLY")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="MET_OFFICE_ONLY"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              strokeDasharray="5 5"
              stroke={metOfficeOnly}
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 1}
              hide={!visibleLines.includes("MET_OFFICE_ONLY")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="GENERATION"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              stroke={toolTipColors.GENERATION}
              strokeWidth={largeScreenMode ? 4 : 2}
              strokeDasharray="5 5"
              hide={!visibleLines.includes("GENERATION")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="GENERATION_UPDATED"
              strokeWidth={largeScreenMode ? 4 : 1}
              stroke={toolTipColors.GENERATION_UPDATED}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              dot={false}
              hide={!visibleLines.includes("GENERATION_UPDATED")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="PAST_FORECAST"
              dot={false}
              connectNulls={true}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              stroke={yellow} //yellow
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 1}
              hide={!visibleLines.includes("FORECAST")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="FORECAST"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              strokeDasharray="5 5"
              stroke={yellow} //yellow
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 1}
              hide={!visibleLines.includes("FORECAST")}
              isAnimationActive={false}
            />
            {zoomEnabled && globalIsZooming && (
              <ReferenceArea
                x1={globalZoomArea?.x1}
                x2={globalZoomArea?.x2}
                className="fill-interactive"
                fillOpacity={0.2}
                xAxisId={"x-axis"}
                yAxisId={"y-axis"}
              />
            )}
            <Tooltip
              // The band above is the hover cursor now. Recharts' default is a vertical rule at
              // the hovered point — the "this instant" reading the selection band just stopped
              // making, and two of them at slightly different x is worse than either alone.
              cursor={isSitesChart ? undefined : false}
              content={({ payload, label }) => {
                const data = payload && payload[0]?.payload;
                if (!data || (data["GENERATION"] === 0 && data["FORECAST"] === 0))
                  return <div></div>;

                let formattedDate = data?.formattedDate + ":00+00:00";
                if (isSitesChart) {
                  const date = new Date(Number(data?.formattedDate));
                  formattedDate = dateToZonedDateTimeString(date, timezone, locale);
                }

                // The heading is the *span* the row's values cover, not the instant the country
                // happens to name it by — the same reading the cursor band draws and the footer
                // spells out. `periodForLabel`, not `periodForInstant`: `formattedDate` is a
                // published data key, and asking the cursor question about a label returns the
                // period after the right one on a period-end country (`lib/time/cursor.ts`).
                // Date on the start only; a period never spans two dates, so repeating it would
                // double the width of the heading to say nothing.
                const tooltipPeriod = isSitesChart
                  ? null
                  : periodForLabel(formattedDate, focusedCountry);
                const tooltipHeading = tooltipPeriod
                  ? `${formatISODateStringHumanNumbersOnly(
                      tooltipPeriod.start,
                      timezone,
                      locale
                    )}–${formatISODateStringAsZonedTime(tooltipPeriod.end, timezone, locale)}`
                  : formatISODateStringHumanNumbersOnly(formattedDate, timezone, locale);

                // Show the p-levels in the tooltip higher ones above the current and lower below
                const pLevelRows = pLevels
                  .flatMap(([lower, upper]) => {
                    // this forecast may not have data for a selected pair (e.g. missing plevels) - skip it
                    const range = data[getPLevelRangeKey(lower, upper)];
                    if (!range) return [];
                    const [min, max] = range;
                    return [
                      [lower, min],
                      [upper, max]
                    ];
                  })
                  .filter(([, value]) => Math.round(value * 100) >= 0)
                  .sort(([a], [b]) => b - a);
                const pLevelRow = ([level, value]: number[]) => (
                  <li key={level} className="font-sans text-2xs" style={{ color: yellow }}>
                    <div className="flex justify-between">
                      <div>{`OCF P${level}`}:</div>
                      <div className="ml-4 font-mono tabular-nums">
                        {prettyPrintYNumberWithCommas(String(value), 1)}
                      </div>
                    </div>
                  </li>
                );
                const upperRows = pLevelRows.filter(([level]) => level > 50).map(pLevelRow);
                const lowerRows = pLevelRows.filter(([level]) => level < 50).map(pLevelRow);

                return (
                  <div className="px-3 py-2 bg-surface-raised bg-opacity-80 shadow">
                    <ul className="">
                      <li className={`flex justify-between pb-2 text-xs text-content font-sans`}>
                        <div className="pr-3 font-mono tabular-nums">{tooltipHeading}</div>
                        <div>{isSitesChart ? "KW" : "MW"}</div>
                      </li>
                      {Object.entries(toolTiplabels)
                        .filter(
                          ([key]) =>
                            (data[key] !== undefined &&
                              visibleLines.includes(key.replace("PAST_", ""))) ||
                            key === "DELTA" ||
                            (key.includes("SEASONAL") && visibleLines.includes("SEASONAL_BOUNDS"))
                        )
                        .map(([key, name]) => {
                          const value = data[key];
                          if (key === "DELTA" && !deltaView) return null;
                          if (typeof value !== "number") return null;
                          // At the "now" boundary both PAST_ and future keys are set — skip the PAST_ duplicate
                          if (key.startsWith("PAST_") && data[key.slice(5)] !== undefined)
                            return null;
                          if (
                            key === "N_HOUR_PAST_FORECAST" &&
                            data["N_HOUR_FORECAST"] !== undefined
                          )
                            return null;
                          if (deltaView && key === "GENERATION" && data["GENERATION_UPDATED"] >= 0)
                            return null;
                          if (
                            key.includes("N_HOUR") &&
                            (!showNHourView || !visibleLines.some((key) => key.includes("N_HOUR")))
                          )
                            return null;
                          const isForecast = ["FORECAST", "PAST_FORECAST"].includes(key);
                          let textClass = "font-normal text-xs";
                          if (isForecast) textClass = "font-semibold";
                          if (key.includes("SEASONAL_P")) textClass = "text-2xs";
                          const pvLiveTextClass =
                            data["GENERATION_UPDATED"] >= 0 &&
                            data["GENERATION"] >= 0 &&
                            key === "GENERATION"
                              ? "text-xs"
                              : "";
                          const sign = ["DELTA"].includes(key)
                            ? Number(value) > 0
                              ? "+"
                              : ""
                            : "";
                          const color = ["DELTA"].includes(key)
                            ? Number(value) > 0
                              ? deltaPos
                              : deltaNeg
                            : toolTipColors[key];
                          const computedValue =
                            key === "DELTA" &&
                            !showNHourView &&
                            `${data["formattedDate"]}:00.000Z` >= currentTime
                              ? "-"
                              : prettyPrintYNumberWithCommas(String(value), 1);
                          let title = name;
                          if (key.includes("N_HOUR")) {
                            title = title.replace("N-hour", `${nHourForecast}-hour`);
                          }

                          return (
                            // the forecast is the p50, wrap it with the higher p-levels above and lower below
                            <React.Fragment key={`item-${key}`}>
                              {isForecast && upperRows}

                              <li className="font-sans" style={{ color }}>
                                <div
                                  className={`flex justify-between ${textClass} ${pvLiveTextClass}`}
                                >
                                  <div>{title}:</div>
                                  <div className={`font-mono tabular-nums ml-4`}>
                                    {(showNHourView || key !== "DELTA") && sign}
                                    {computedValue}{" "}
                                  </div>
                                </div>
                              </li>

                              {isForecast && lowerRows}
                            </React.Fragment>
                          );
                        })}
                    </ul>
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RemixLine;
