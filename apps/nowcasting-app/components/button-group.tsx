interface IButtonGroup {
  rightString: string;
}

const ButtonGroup = ({ rightString }: IButtonGroup) => {
  return (
    <span className="relative z-0 w-full flex justify-end shadow-sm mx-0">
      <button
        type="button"
        className="relative w-32 items-center px-3 py-2 text-sm mx-2 font-extrabold text-black bg-ocf-yellow disabled:cursor-not-allowed hover:bg-ocf-yellow focus:z-10 focus:bg-ocf-yellow focus:text-black"
      >
        PV FORECAST
      </button>
      <button
        type="button"
        disabled
        className="relative w-32 items-center px-3 py-2 mx-2 ml-px text-sm font-extrabold text-white bg-black disabled:cursor-not-allowed focus:z-10 focus:bg-ocf-yellow focus:text-black"
      >
        SOLAR SITES
      </button>
      <button
        type="button"
        disabled
        className="relative w-32 items-center px-3 py-2 ml-px text-sm font-extrabold text-white bg-black disabled:cursor-not-allowed focus:z-10 focus:bg-ocf-yellow focus:text-black"
      >
        DELTA
      </button>
       <div className="absolute left-0 top-0 items-center px-3 py-2 mx-1  ml-px text-lg font-extrabold text-black bg-white">
        {rightString}
      </div>
    </span>
  );
};

export default ButtonGroup;
