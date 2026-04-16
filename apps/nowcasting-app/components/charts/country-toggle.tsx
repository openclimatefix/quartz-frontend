import React from "react";

export type Country = "GB" | "NL";

const CountryToggle: React.FC<{
  selected: Country;
  onChange: (c: Country) => void;
  size?: "default" | "title";
}> = ({ selected, onChange, size = "default" }) => {
  const btnClass =
    size === "title"
      ? "px-2.5 py-0.5 text-base md:text-lg lg:text-2xl dash:xl:text-3xl dash:tracking-wide font-black rounded transition-colors"
      : "px-2 py-0.5 text-sm font-bold rounded transition-colors";

  return (
    <div className="flex items-center gap-1 px-2">
      {(["GB", "NL"] as Country[]).map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`${btnClass} ${
            selected === c ? "bg-ocf-yellow text-black" : "text-ocf-gray-400 hover:text-white"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
};

export default CountryToggle;
