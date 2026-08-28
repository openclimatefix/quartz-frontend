import { FC } from "react";

import {
  CONTROL_BUTTON_BASE,
  CONTROL_BUTTON_OFF,
  CONTROL_BUTTON_ON,
  CONTROL_LAMP_BASE,
  CONTROL_LAMP_BUSY,
  CONTROL_LAMP_OFF,
  CONTROL_LAMP_ON,
  CONTROL_ROW_MULTI
} from "./control-button";
import useGlobalState from "../helpers/globalState";
import {
  SATELLITE_CHANNELS,
  SATELLITE_CHANNEL_LABELS,
  ChannelSelection,
  COMPOSITE_SELECTIONS
} from "../helpers/satelliteLayer";

/**
 * The forecast map's own basemap layer toggles — Clouds (satellite) and the yellow PV forecast
 * fill. The channel/composite picker that goes with them is `SatelliteChannelSelect` below,
 * exported separately because it spans the panel's full width where these take half of it.
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
 * Both fills, not just the forecast one. This was forecast-only while `deltaMap.tsx` existed —
 * a second Mapbox instance with no satellite layers and no fill worth hiding. One instance
 * repaints now, so "Clouds" and "PV" describe the map rather than the encoding, and the PV
 * button hides whichever fill is drawn (the layer ids are the same either way).
 */
/**
 * `aria-hidden`: the button already carries `aria-pressed`, which says the same thing in the
 * one place a screen reader looks. A second announcement of the same state is noise.
 */
const Lamp: FC<{ on: boolean; busy?: boolean }> = ({ on, busy = false }) => (
  <span
    aria-hidden
    className={`${CONTROL_LAMP_BASE} ${
      busy ? CONTROL_LAMP_BUSY : on ? CONTROL_LAMP_ON : CONTROL_LAMP_OFF
    }`}
  />
);

const MapLayerControls: FC = () => {
  const [showCloudLayer, setShowCloudLayer] = useGlobalState("showCloudLayer");
  const [showPvLayer, setShowPvLayer] = useGlobalState("showPvLayer");
  const [isSatelliteLoading] = useGlobalState("isSatelliteLoading");

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-2xs font-semibold uppercase tracking-wider text-content-secondary">
        Layers
      </span>
      <div className={`${CONTROL_ROW_MULTI} flex-wrap`}>
        <button
          type="button"
          onClick={() => {
            const turningOff = showCloudLayer;
            setShowCloudLayer(!showCloudLayer);
            if (turningOff) setShowPvLayer(true);
          }}
          aria-pressed={showCloudLayer}
          className={`${CONTROL_BUTTON_BASE} py-1.5 gap-1 ${
            showCloudLayer ? CONTROL_BUTTON_ON : CONTROL_BUTTON_OFF
          }`}
        >
          <Lamp on={showCloudLayer} busy={isSatelliteLoading} />
          Clouds
        </button>

        <button
          type="button"
          // Not "the yellow overlay" any more: the same button hides the delta fill when a
          // comparison is selected, and that one is not yellow.
          title="Toggle the region fill so clouds are easier to see"
          onClick={() => setShowPvLayer((v) => !v)}
          aria-pressed={showPvLayer}
          className={`${CONTROL_BUTTON_BASE} py-1.5 gap-1 ${
            showPvLayer ? CONTROL_BUTTON_ON : CONTROL_BUTTON_OFF
          }`}
        >
          <Lamp on={showPvLayer} />
          PV
        </button>
      </div>
    </div>
  );
};

/**
 * The satellite channel/composite picker, exported separately from the layer buttons above it.
 *
 * It is a full-width control living beside a half-width one. Inside `MapLayerControls` it was
 * confined to the "Layers" column and its longer option labels were clipped — "Couldn't load
 * satellite" ran straight off the edge, which is exactly the case where the text matters most.
 * Split out, the panel can span it across both columns underneath them (see
 * `map-encoding-controls.tsx`), and the two button groups keep their half each.
 *
 * It renders nothing when the cloud layer is off, so it never leaves an empty row behind. That
 * is why it reads `showCloudLayer` itself rather than taking it as a prop: as a direct child of
 * the panel's grid, being absent has to mean *no grid item*, not an item that happens to be
 * empty.
 */
export const SatelliteChannelSelect: FC = () => {
  const [showCloudLayer] = useGlobalState("showCloudLayer");
  const [activeChannel, setActiveChannel] = useGlobalState("activeChannel");
  const [satelliteError] = useGlobalState("satelliteError");

  if (!showCloudLayer) return null;

  return (
    <select
      value={activeChannel}
      onChange={(e) => setActiveChannel(e.target.value as ChannelSelection)}
      disabled={!!satelliteError}
      aria-label="Satellite channel"
      className="col-span-5 w-full cursor-pointer rounded border-none bg-surface-inner px-2 py-1 text-xs font-semibold text-content outline-none disabled:cursor-not-allowed disabled:opacity-70"
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
  );
};

export default MapLayerControls;
