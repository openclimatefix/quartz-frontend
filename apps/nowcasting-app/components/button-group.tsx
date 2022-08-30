/*
Contains button that are on top of the map
1. PV forecast
2. Solar Sites (not working)
3. Delta view (not working)
*/

interface IButtonGroup {
  rightString: string;
}

const ButtonGroup = ({ rightString }: IButtonGroup) => {
  return (
    <span className="relative z-0 w-full inline-flex shadow-sm">
      <button
        type="button"
        className="relative inline-flex items-center px-3 py-1 text-sm font-extrabold text-black bg-ocf-yellow disabled:cursor-not-allowed hover:bg-ocf-yellow focus:z-10 focus:bg-ocf-yellow focus:text-black"
      >
        PV FORECAST
      </button>
      <button
        type="button"
        disabled
        className="relative inline-flex items-center px-3 py-1 ml-px text-sm font-extrabold text-white bg-black disabled:cursor-not-allowed focus:z-10 focus:bg-ocf-yellow focus:text-black"
      >
        SOLAR SITES
      </button>
      <button
        type="button"
        disabled
        className="relative inline-flex items-center px-3 py-1 ml-px text-sm font-extrabold text-white bg-black disabled:cursor-not-allowed focus:z-10 focus:bg-ocf-yellow focus:text-black"
      >
        DELTA
      </button>
      <div className="absolute right-5 top-0 items-center px-3 py-1 ml-px text-md font-medium text-white bg-ocf-black ">
        {rightString}
      </div>
    </span>
  );
};

export default ButtonGroup;
