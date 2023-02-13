import React, { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { theme } from "../../../tailwind.config";
import useGlobalState from "../../helpers/globalState";
import { DELTA_BUCKET } from "../../../constant";
import { Bucket, GspDeltaValue } from "../../types";
import { createBucketObject } from "../../helpers/utils";

const BucketItem: React.FC<Bucket> = ({
  dataKey,
  quantity,
  text,
  bucketColor,
  borderColor,
  textColor,
  altTextColor,
  lowerBound,
  upperBound
}) => {
  const selectedClass = `${borderColor}`;
  const unselectedClass = `bg-opacity-0 ${
    borderColor === "border-white" ? "border-ocf-gray-800" : borderColor
  }`;
  const [selectedBuckets, setSelectedBuckets] = useGlobalState("selectedBuckets");
  const isSelected = selectedBuckets.includes(dataKey);
  const toggleBucketSelection = () => {
    if (isSelected) {
      setSelectedBuckets(selectedBuckets.filter((bucket) => bucket !== dataKey));
    } else {
      setSelectedBuckets([...selectedBuckets, dataKey]);
    }
  };

  return (
    <>
      <div
        className={`${isSelected ? `${textColor}` : `${altTextColor}`} justify-between flex flex-1
            flex-col items-center rounded`}
      >
        <button
          className={`flex flex-col flex-1 w-full h-16 items-center p-1 pt-2 rounded-md justify-center border-2 ${bucketColor} ${
            isSelected ? selectedClass : unselectedClass
          }`}
          onClick={toggleBucketSelection}
        >
          <span className="text-2xl font-semibold">{quantity}</span>
          <span className="flex text-xs pb-2">
            {text === DELTA_BUCKET.ZERO.toString() ? `-/+` : `${text} MW`}
          </span>
        </button>
      </div>
    </>
  );
};

const DeltaBuckets: React.FC<{
  gspDeltas: Map<number, GspDeltaValue>;
  bucketSelection: string[];
  setClickedGspId?: Dispatch<SetStateAction<number | undefined>>;
  negative?: boolean;
  lowerBound?: number;
  upperBound?: number;
}> = ({ gspDeltas, negative = false }) => {
  if (!gspDeltas.size) return null;

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
      <div className="flex justify-center mx-3 pb-10 gap-1 lg:gap-3">
        {buckets.map((bucket) => {
          return <BucketItem key={`Bucket-${bucket.dataKey}`} {...bucket}></BucketItem>;
        })}
      </div>
    </>
  );
};

export default DeltaBuckets;
