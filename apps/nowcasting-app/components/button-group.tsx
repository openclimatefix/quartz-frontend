import { classNames } from "./utils";

interface IButtonGroup {
  options: [
    {
      label: string;
      active: boolean;
      onClick: React.Dispatch<React.SetStateAction<any>>;
    }
  ];
}

const ButtonGroup = ({ options }: IButtonGroup) => {
  const ACTIVE_BUTTON_STYLES =
    "bg-danube-500 focus:ring-black focus:border-black text-white";
  const INACTIVE_BUTTON_STYLES =
    "bg-white hover:bg-gray-50 focus:ring-danube-500 focus:border-danube-500";
  const BASE_BUTTON_STYLES =
    "relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 focus:z-10 focus:outline-none focus:ring-1";
  const FIRST_BUTTON_STYLES = "rounded-l-md";
  const LAST_BUTTON_STYLES = "rounded-r-md";

  return (
    <span className="relative z-0 inline-flex rounded-md shadow-sm">
      {options.length === 1 && (
        <button
          className={classNames(
            options[0].active ? ACTIVE_BUTTON_STYLES : INACTIVE_BUTTON_STYLES,
            BASE_BUTTON_STYLES,
            FIRST_BUTTON_STYLES,
            LAST_BUTTON_STYLES
          )}
          onClick={options[0].onClick}
        >
          {options[0].label}
        </button>
      )}
      {options.length >= 2 &&
        options.map(({ label, onClick, active }, index) => (
          <button
            key={`button-${index}`}
            className={classNames(
              active ? ACTIVE_BUTTON_STYLES : INACTIVE_BUTTON_STYLES,
              index === 0 && FIRST_BUTTON_STYLES,
              index > 0 && "-ml-px",
              index === options.length - 1 && LAST_BUTTON_STYLES,
              BASE_BUTTON_STYLES
            )}
            onClick={onClick}
          >
            {label}
          </button>
        ))}
    </span>
  );
};

export default ButtonGroup;
