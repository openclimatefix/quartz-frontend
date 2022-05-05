interface IButtonGroup {}

const ButtonGroup = ({}: IButtonGroup) => {
  return (
    <span className="relative z-0 inline-flex shadow-sm">
      <button
        type="button"
        className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
      >
        PV Forecast
      </button>
      <button
        type="button"
        className="relative inline-flex items-center px-4 py-2 -ml-px text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
      >
        Solar Sites
      </button>
      <button
        type="button"
        className="relative inline-flex items-center px-4 py-2 -ml-px text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
      >
        Delta
      </button>
    </span>
  );
};

export default ButtonGroup;
