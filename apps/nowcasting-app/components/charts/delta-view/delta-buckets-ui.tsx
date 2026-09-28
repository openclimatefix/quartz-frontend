import React, { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { theme } from "../../../tailwind.config";
import useGlobalState from "../../helpers/globalState";
import { DELTA_BUCKET, deltaBucketEdge } from "../../../constant";
import { ActiveUnit } from "../../map/types";
import { Bucket, GspDeltaValue } from "../../types";
import { createBucketObject } from "../../helpers/utils";
import { displayDecimalsFor, toDisplayPower } from "../../../lib/domain/power-unit";
import type { PowerUnit } from "../../../config/countries";
import {
  deltaExtent,
  deltaRampColor,
  deltaRampWantsDarkText,
  deltaTopFor
} from "../../../lib/domain/delta-ramp";
import { useFocusedCountry } from "../../../hooks/data";

/**
 * Legible text colour for a chip painted with the delta ramp, chosen by contrast against the
 * chip's actual colour — see `deltaRampWantsDarkText` for why distance from zero was not enough.
 */
const deltaTextClass = (value: number, extent: number): string =>
  deltaRampWantsDarkText(value, extent) ? "text-content-on-accent" : "text-content";

const BucketItem: React.FC<Bucket & { unit: PowerUnit }> = ({
  dataKey,
  quantity,
  text,
  lowerBound,
  upperBound,
  unit
}) => {
  const [selectedBuckets, setSelectedBuckets] = useGlobalState("selectedBuckets");
  const [activeUnit] = useGlobalState("activeUnit");
  // Capacity has no delta, so it labels as megawatts — the same fold the map and the deltas
  // hook make.
  const asPercentage = activeUnit === ActiveUnit.percentage;
  // The focused country's region-tier scale, which is what `use-gsp-deltas.ts` filed these
  // regions under — the chips must label the edges the regions were actually sorted on.
  const country = useFocusedCountry();
  const mwTop = deltaTopFor(country, false);
  const isSelected = selectedBuckets.includes(dataKey);
  const toggleBucketSelection = () => {
    if (isSelected) {
      setSelectedBuckets(selectedBuckets.filter((bucket) => bucket !== dataKey));
    } else {
      setSelectedBuckets([...selectedBuckets, dataKey]);
    }
  };

  // These rows genuinely ARE buckets — the GSPs really are grouped into nine bins — so the
  // grouping stays. But each row used to pick a hand-kept `ocf-delta-N00` swatch for its bin;
  // it now samples the same continuous ramp the map paints, at the bucket's own EDGE value, so
  // a row's colour is exactly the colour the map would give a region sitting right on that
  // boundary. `deltaBucketEdge`'s percentage form already comes back as a percentage (e.g. 35,
  // not 0.35), so the extent it is compared against needs the same scaling — `deltaExtent`
  // is normalised (0–1 of capacity), hence the `* 100` below.
  const bucket = DELTA_BUCKET[dataKey as keyof typeof DELTA_BUCKET];
  const edge = deltaBucketEdge(bucket, asPercentage, mwTop);
  const extent = asPercentage ? deltaExtent(true) * 100 : mwTop;
  const rampColor = deltaRampColor(edge, extent);
  const textClass = deltaTextClass(edge, extent);
  const isZero = bucket === DELTA_BUCKET.ZERO;

  // Unselected rows used to show `altTextColor` — the bucket's own hue as text on an
  // otherwise-empty chip, or `text-surface-panel` for the neutral bucket, which had no hue of
  // its own to show. The ramp keeps that split: a non-zero bucket still tints its own outline
  // and text with its ramp colour; the zero bucket falls back to the ordinary panel/content
  // classes, since its ramp colour is the same neutral grey as its own fill and would draw an
  // invisible border rather than a deliberate one.
  // Off, the zero chip sinks instead of tinting: its ramp colour IS the panel's black now
  // (the midpoint is the map's ground), so an outline in it drew nothing and the chip read as
  // a hole. A recessed ground and a faint edge give it a shape without giving it a hue it does
  // not have.
  const zeroBorderClass = isSelected ? "border-content" : "border-edge";
  const zeroGroundClass = isSelected ? "" : "bg-surface-sunken";

  return (
    <>
      <div
        className={`${
          isSelected ? textClass : isZero ? "text-content-secondary" : ""
        } justify-between flex flex-1 flex-col items-center rounded`}
      >
        <button
          // The fill is a computed rgb(), not a Tailwind swatch, so background and border come
          // from an inline style rather than `bg-ocf-delta-*` / `border-ocf-delta-*` classes,
          // except for the zero bucket's border, which keeps its fixed content/panel classes.
          className={`flex flex-col flex-1 w-full items-center p-1 rounded-md justify-center border-2 ${
            isZero ? `${zeroBorderClass} ${zeroGroundClass}` : ""
          }`}
          style={{
            backgroundColor: isSelected ? rampColor : "transparent",
            borderColor: isZero ? undefined : rampColor,
            color: isSelected || isZero ? undefined : rampColor
          }}
          onClick={toggleBucketSelection}
        >
          <span className="text-xl font-semibold leading-tight">{quantity}</span>
          {/*
            The edge in whichever unit the map is painting, from the shared lookup — this was
            `${text} MW`, which was true only while the buckets were megawatts. `text` is the
            bucket's enum value, i.e. its ordinal, so it stops being a megawatt figure the
            moment percentage mode uses the same nine cells for capacity fractions.

            The edge itself is still computed in MW — the enum's ladder stretched to the
            country's own top — so a non-percentage figure is converted to the focused
            country's unit only for display, the same last step every other regional figure
            goes through.
          */}
          <span className="flex text-xs">
            {text === DELTA_BUCKET.ZERO.toString()
              ? `-/+`
              : asPercentage
              ? `${deltaBucketEdge(DELTA_BUCKET[dataKey as keyof typeof DELTA_BUCKET], true)}%`
              : `${toDisplayPower(
                  deltaBucketEdge(DELTA_BUCKET[dataKey as keyof typeof DELTA_BUCKET], false, mwTop),
                  unit
                ).toFixed(displayDecimalsFor(unit))} ${unit}`}
          </span>
        </button>
      </div>
    </>
  );
};

const DeltaBuckets: React.FC<{
  gspDeltas: Map<string, GspDeltaValue> | undefined;
  bucketSelection: string[];
  unit: PowerUnit;
  setClickedGspId?: Dispatch<SetStateAction<number | undefined>>;
  negative?: boolean;
  lowerBound?: number;
  upperBound?: number;
}> = ({ gspDeltas, unit, negative = false }) => {
  if (!gspDeltas?.size) return null;

  const deltaArray = Array.from(gspDeltas.values());

  const groupedDeltas: Map<DELTA_BUCKET, GspDeltaValue[]> = new Map([
    [DELTA_BUCKET.NEG4, []],
    [DELTA_BUCKET.NEG3, []],
    [DELTA_BUCKET.NEG2, []],
    [DELTA_BUCKET.NEG1, []],
    [DELTA_BUCKET.ZERO, []],
    [DELTA_BUCKET.POS1, []],
    [DELTA_BUCKET.POS2, []],
    [DELTA_BUCKET.POS3, []],
    [DELTA_BUCKET.POS4, []]
  ]);
  deltaArray.forEach((delta) => {
    groupedDeltas.set(delta.deltaBucket, [...(groupedDeltas.get(delta.deltaBucket) || []), delta]);
  });
  const buckets: Bucket[] = [];
  groupedDeltas.forEach((deltaGroup, deltaBucket) => {
    buckets.push(createBucketObject(deltaBucket, deltaGroup));
  });

  return (
    <>
      <div className="sticky top-0 bg-surface-panel z-10 mx-3 pb-1 flex justify-center gap-1 lg:gap-3">
        {buckets.map((bucket) => {
          return <BucketItem key={`Bucket-${bucket.dataKey}`} {...bucket} unit={unit}></BucketItem>;
        })}
      </div>
    </>
  );
};

export default DeltaBuckets;
