import { FC } from "react";

import useGlobalState from "../helpers/globalState";
import {
  SATELLITE_CHANNELS,
  SATELLITE_CHANNEL_LABELS,
  ChannelSelection,
  COMPOSITE_SELECTIONS
} from "../helpers/satelliteLayer";

/**
 * The forecast map's own basemap layer toggles — Clouds (satellite) and the yellow PV forecast
 * fill — plus the channel/composite picker for whichever satellite view is active.
 *
 * Moved out of `map.tsx` by the Phase 6 followup (Track I), which consolidates every map
 * control into the one top-right panel Brad asked for twice ("consolidate the map controls
 * ... into one panel"). Track G got the encoding cluster and this row into the same *corner*
 * but stacked as two separate floating things, because `map.tsx` was off-limits to it at the
 * time — see `geometry.ts`'s history. `map.tsx` is free now, so this is the rest of that move.
 *
 * `map.tsx` still owns the satellite fetch/decode pipeline — it needs the live Mapbox instance,
 * which this component has no reason to hold. `showCloudLayer`, `activeChannel` and
 * `showPvLayer` were already global state (for the same cross-component-visibility reason this
 * move continues); `isSatelliteLoading` and `satelliteError` joined them in `globalState.tsx`
 * so this component can show the spinner and the error text without `map.tsx` rendering
 * anything itself.
 *
 * Forecast-only, same as before: the delta map has no satellite/PV fill to toggle.
 * `map-encoding-controls.tsx` mounts this only when `comparison` is null — the condition that
 * replaces `map.tsx`'s old `title === MAP_TITLE_FORECAST` check, expressed at the one place
 * that now knows which map is showing.
 */
const MapLayerControls: FC = () => {
  const [showCloudLayer, setShowCloudLayer] = useGlobalState("showCloudLayer");
  const [activeChannel, setActiveChannel] = useGlobalState("activeChannel");
  const [showPvLayer, setShowPvLayer] = useGlobalState("showPvLayer");
  const [satelliteError] = useGlobalState("satelliteError");
  const [isSatelliteLoading] = useGlobalState("isSatelliteLoading");

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-2xs font-semibold uppercase tracking-wider text-ocf-gray-600">
        Layers
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const turningOff = showCloudLayer;
            setShowCloudLayer(!showCloudLayer);
            if (turningOff) setShowPvLayer(true);
          }}
          className={`relative inline-flex items-center px-3 py-0.5 text-sm dash:text-lg dash:tracking-wide font-extrabold transition-all active:scale-95 ${
            showCloudLayer
              ? "text-black bg-ocf-yellow"
              : "text-white bg-black hover:bg-ocf-yellow hover:text-mapbox-black-700"
          }`}
        >
          {isSatelliteLoading && (
            <svg
              className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          Clouds
        </button>

        <button
          type="button"
          title="Toggle the yellow PV forecast overlay so clouds are easier to see"
          onClick={() => setShowPvLayer((v) => !v)}
          className={`relative inline-flex items-center px-3 py-0.5 text-sm dash:text-lg dash:tracking-wide font-extrabold transition-all active:scale-95 ${
            showPvLayer
              ? "text-black bg-ocf-yellow"
              : "text-white bg-black hover:bg-ocf-yellow hover:text-mapbox-black-700"
          }`}
        >
          PV
        </button>
      </div>

      {showCloudLayer && (
        <select
          value={activeChannel}
          onChange={(e) => setActiveChannel(e.target.value as ChannelSelection)}
          disabled={!!satelliteError}
          className="w-full bg-black text-white text-xs font-semibold py-1 px-1.5 border-none outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
        >
          {satelliteError ? (
            <option value={activeChannel}>{satelliteError}</option>
          ) : (
            <>
              <optgroup label="Composites">
                {Object.entries(COMPOSITE_SELECTIONS).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Individual bands">
                {SATELLITE_CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {SATELLITE_CHANNEL_LABELS[ch]}
                  </option>
                ))}
              </optgroup>
            </>
          )}
        </select>
      )}
    </div>
  );
};

export default MapLayerControls;
