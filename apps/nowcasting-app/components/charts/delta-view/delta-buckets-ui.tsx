import React from "react";
import { theme } from "../../../tailwind.config";
import useGlobalState from "../../helpers/globalState";
import { GspDeltaValue } from "../../types";
import { Dispatch, FC, ReactElement, SetStateAction, useMemo, useState } from "react";

type DeltaBucketProps = {
  className?: string;
  bucketSelection?: string[];
  bucketRange: string[];
};

type Bucket = {
  dataKey: string;
  quantity: number;
  text: string;
  bucketColor: string;
  lowerBound: number;
  upperBound: number;
  increment: number;
  textColor?: string;
  gspDeltas?: Map<number, GspDeltaValue>;
  setClickedGspId?: Dispatch<SetStateAction<number | undefined>>;
};

export const BucketItem: React.FC<Bucket> = ({
  dataKey,
  quantity,
  text,
  lowerBound,
  upperBound,
  increment,
  bucketColor,
  textColor,
  gspDeltas,
  setClickedGspId
}) => {
  const selectedClass = ``;
  const unselectedClass = "opacity-40";
  const [selectedBuckets, setSelectedBuckets] = useGlobalState("selectedBuckets");
  const [bucketRange, setBucketRange] = useState({});
  const isSelected = selectedBuckets.includes(dataKey);

  const toggleBucketSelection = () => {
    if (isSelected) {
      setSelectedBuckets(selectedBuckets.filter((bucket) => bucket !== dataKey));
      // setSelectedDeltas(selectedDeltas).filter((list)=> list !== deltaGroup)
    } else {
      setSelectedBuckets([...selectedBuckets, dataKey]);
      const createRange = (from = lowerBound, to = upperBound, step = increment) => {
        const rangeArray = [...Array(Math.floor((to - from) / step) + step)].map(
          (_, i) => from + i * step
        );
        setBucketRange(rangeArray);
        return bucketRange;
      };
      createRange(lowerBound, upperBound, increment);
      console.log(bucketRange);
      console.log(selectedBuckets);
    }
  };

  const deltaArray = Array.from(gspDeltas.values());

  return (
    <>
      <div
        className={`text-${textColor} justify-between flex flex-1
            flex-col items-center rounded`}
      >
        <button
          className={`flex flex-col flex-1 w-full h-16 items-center p-1 pt-3 rounded-md justify-center ${bucketColor} ${
            isSelected ? selectedClass : unselectedClass
          } ${dataKey === "0" && "border-2 border-ocf-gray-800"}`}
          onClick={toggleBucketSelection}
        >
          <span className="text-2xl font-semibold">{quantity}</span>
          <span className="flex text-xs pb-2">{text}</span>
        </button>
      </div>
    </>
  );
};

//there needs to be some code here that gets how many GSPs are in a specific bucket

//we have an array and need to filter the array for the different values that return an array of x length.whatever that length is will be the number on the button

const DeltaBuckets: React.FC<DeltaBucketProps> = ({ className, bucketSelection, bucketRange }) => {
  return (
    <div className="flex justify-center mx-3 pb-10 gap-1 lg:gap-3">
      <BucketItem
        dataKey={"-4"}
        text={"-80"}
        bucketColor={"bg-ocf-delta-100"}
        textColor={"ocf-black"}
        quantity={22}
        lowerBound={-80}
        upperBound={-60}
        increment={1}
      ></BucketItem>
      <BucketItem
        dataKey={"-3"}
        text={"-60"}
        bucketColor={"bg-ocf-delta-200"}
        textColor={"ocf-black"}
        quantity={26}
        lowerBound={-59}
        upperBound={-40}
        increment={1}
      ></BucketItem>
      <BucketItem
        dataKey={"-2"}
        text={"-40"}
        bucketColor={"bg-ocf-delta-300"}
        textColor={"ocf-black"}
        quantity={35}
        lowerBound={-39}
        upperBound={-20}
        increment={1}
      ></BucketItem>
      <BucketItem
        dataKey={"-1"}
        text={"-20"}
        bucketColor={"bg-ocf-delta-400"}
        textColor={"ocf-white"}
        quantity={52}
        lowerBound={-19}
        upperBound={-1}
        increment={1}
      ></BucketItem>
      <BucketItem
        dataKey={"0"}
        text={"+/- MW"}
        bucketColor={"bg-ocf-delta-500"}
        textColor={"ocf-white"}
        quantity={321}
        lowerBound={-1}
        upperBound={1}
        increment={1}
      ></BucketItem>
      <BucketItem
        dataKey={"1"}
        text={"+20"}
        bucketColor={"bg-ocf-delta-600"}
        textColor={"ocf-white"}
        quantity={17}
        lowerBound={2}
        upperBound={20}
        increment={1}
      ></BucketItem>
      <BucketItem
        dataKey={"2"}
        text={"+40"}
        bucketColor={"bg-ocf-delta-700"}
        textColor={"ocf-black"}
        quantity={35}
        lowerBound={21}
        upperBound={39}
        increment={1}
      ></BucketItem>
      <BucketItem
        dataKey={"3"}
        text={"+60"}
        bucketColor={"bg-ocf-delta-800"}
        textColor={"ocf-black"}
        quantity={5}
        lowerBound={40}
        upperBound={59}
        increment={1}
      ></BucketItem>
      <BucketItem
        dataKey={"4"}
        text={"+80"}
        bucketColor={"bg-ocf-delta-900"}
        textColor={"ocf-black"}
        quantity={27}
        lowerBound={60}
        upperBound={80}
        increment={1}
      ></BucketItem>
    </div>
  );
};

export default DeltaBuckets;
