interface IButtonGroup {}

const ButtonGroup = ({}: IButtonGroup) => {
  return (
    <span className="relative z-0 inline-flex shadow-sm">
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
    </span>
  );
};

export default ButtonGroup;
