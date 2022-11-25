import React from "react";
import { useState } from "react";
import { theme } from "../../../tailwind.config";

type DeltaBucketProps = {
  className?: string;
};

type Bucket = {
  id: string;
  quantity: number;
  text: string;
  bucketColor: string;
  textColor?: string;
};

const DeltaBuckets: React.FC<DeltaBucketProps> = ({ className }) => {
  const bucketValues: Bucket[] = [
    {
      id: "-4",
      text: "-500",
      bucketColor: "bg-ocf-delta-100",
      textColor: "ocf-black",
      quantity: 85
    },
    {
      id: "-3",
      text: "-400",
      bucketColor: "bg-ocf-delta-200",
      textColor: "ocf-black",
      quantity: 32
    },
    {
      id: "-2",
      text: "-300",
      bucketColor: "bg-ocf-delta-300",
      textColor: "ocf-black",
      quantity: 67
    },
    {
      id: "-1",
      text: "-200",
      bucketColor: "bg-ocf-delta-400",
      textColor: "ocf-white",
      quantity: 15
    },
    {
      id: "0",
      text: "+/- MW",
      bucketColor: "bg-ocf-delta-500",
      textColor: "ocf-white",
      quantity: 321
    },
    {
      id: "1",
      text: "+200",
      bucketColor: "bg-ocf-delta-600",
      textColor: "ocf-white",
      quantity: 17
    },
    {
      id: "2",
      text: "+300",
      bucketColor: "bg-ocf-delta-700",
      textColor: "ocf-black",
      quantity: 35
    },
    { id: "3", text: "+400", bucketColor: "bg-ocf-delta-800", textColor: "ocf-black", quantity: 5 },
    { id: "4", text: "+500", bucketColor: "bg-ocf-delta-900", textColor: "ocf-black", quantity: 27 }
  ];

  const [isActive, setIsActive] = useState(true);
  const [selected, setSelected] = useState([]);

  const selectedClass = ``;
  const unselectedClass = "opacity-40";

  //there needs to be some code here that gets how many GSPs are in a specific bucket

  //bucket knows if it's selected or not

  //we have an array and need to filter the array for the different values that return an array of x length.whatever that length is will be the number on the button

  //should set up global state similar to selecting and deselecting the lines on the chart

  //there needs to be some style changes when a button is clicked (could do a darker color or a border)

  return (
    <>
      <div className="flex justify-center mx-3 pb-10 gap-1 lg:gap-3">
        {bucketValues.map((bucket) => (
          <div
            key={bucket.text}
            className={`text-${bucket.textColor} justify-between flex flex-1
            flex-col items-center rounded`}
          >
            <button
              className={`flex flex-col flex-1 w-full items-center p-1 pt-3 rounded-md justify-center ${
                bucket.bucketColor
              } ${isActive ? selectedClass : unselectedClass} ${
                bucket.id === "0" && "border-2 border-ocf-gray-800"
              }`}
              onClick={() => setIsActive(!isActive)}
            >
              <span className="text-2xl font-semibold">{bucket.quantity}</span>
              <span className="flex text-xs pb-2">{bucket.text}</span>
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default DeltaBuckets;
