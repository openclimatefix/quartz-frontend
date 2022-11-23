import React from "react";
import { useState } from "react";
import { theme } from "../../../tailwind.config";

type DeltaBucketProps = {
  className?: string;
};

const DeltaBuckets: React.FC<DeltaBucketProps> = ({ className }) => {
  const bucketValues = [
    { text: "-500", bucketcolor: "bg-ocf-delta-100", textColor: "ocf-black", quantity: "85" },
    { text: "-400", bucketcolor: "bg-ocf-delta-200", textColor: "ocf-black", quantity: "32" },
    { text: "-300", bucketcolor: "bg-ocf-delta-300", textColor: "ocf-black", quantity: "67" },
    { text: "-200", bucketcolor: "bg-ocf-delta-400", textColor: "ocf-black", quantity: "15" },
    { text: "+/-", bucketcolor: "bg-ocf-delta-500", textColor: "ocf-black", quantity: "321" },
    { text: "+200", bucketcolor: "bg-ocf-delta-600", textColor: "ocf-black", quantity: "17" },
    { text: "+300", bucketcolor: "bg-ocf-delta-700", textColor: "ocf-black", quantity: "35" },
    { text: "+400", bucketcolor: "bg-ocf-delta-800", textColor: "ocf-black", quantity: "5" },
    { text: "+500", bucketcolor: "bg-ocf-delta-900", textColor: "ocf-black", quantity: "27" }
  ];

  const [isActive, setIsActive] = useState(false);
  const [selected, setSelected] = useState([]);

  const selectedClass = `border-white border-2 flex flex-col items-center pb-3 pt-5 m-2 h-20 w-24 rounded bg-transparent`;
  const unselectedClass =
    "flex flex-col border-transparent border-2 items-center pb-3 pt-5 m-2 h-20 w-24 rounded bg-transparent";

  //there needs to be some code here that gets how many GSPs are in a specific bucket

  //we have an array and need to filter the array for the different values that return an array of x length.whatever that length is will be the number on the button

  //should set up global state similar to selecting and deselecting the lines on the chart

  //there needs to be some style changes when a button is clicked (could do a darker color or a border)

  return (
    <>
      <div className="flex justify-center basis-3/4 mx-10 pb-10">
        {bucketValues.map((bucket) => (
          <div
            key={bucket.text}
            className={`text-${bucket.textColor} justify-between flex 
            flex-col items-center mx-2 h-20 w-24 rounded ${bucket.bucketcolor}`}
          >
            <button
              className={isActive ? unselectedClass : selectedClass}
              onClick={() => setIsActive(!isActive)}
            >
              <span className="text-3xl font-semibold">{bucket.quantity}</span>
              <span className="flex text-s pb-2">{bucket.text} MW</span>
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default DeltaBuckets;
