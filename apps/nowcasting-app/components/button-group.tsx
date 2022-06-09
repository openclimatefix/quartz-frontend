interface IButtonGroup {
  rightString: string;
}

const ButtonGroup = ({ rightString }: IButtonGroup) => {
  return (
    <span className="relative z-0 w-full inline-flex shadow-sm">
      <button
        type="button"
        className="relative inline-flex items-center px-3 py-1 text-sm font-extrabold text-black bg-amber-400 disabled:cursor-not-allowed hover:bg-amber-400 focus:z-10 focus:bg-amber-400 focus:text-black"
      >
        PV FORECAST
      </button>
      <button
        type="button"
        disabled
        className="relative inline-flex items-center px-3 py-1 ml-px text-sm font-extrabold text-white bg-black disabled:cursor-not-allowed focus:z-10 focus:bg-amber-400 focus:text-black"
      >
        SOLAR SITES
      </button>
      <button
        type="button"
        disabled
        className="relative inline-flex items-center px-3 py-1 ml-px text-sm font-extrabold text-white bg-black disabled:cursor-not-allowed focus:z-10 focus:bg-amber-400 focus:text-black"
      >
        DELTA
      </button>
      <div className="absolute right-5 top-0 items-center px-3 py-1 ml-px text-md font-medium text-white bg-mapbox-black ">
        {rightString}
      </div>
    </span>
  );
};

export default ButtonGroup;
