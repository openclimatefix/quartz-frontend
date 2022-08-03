type ExpandButtonProps = { isOpen: boolean; onClick: () => void };

const ExpandButton: React.FC<ExpandButtonProps> = ({ onClick, isOpen }) => {
  return (
    <button
      className="items-center w-10 h-8  text-lg m text-black bg-white  hover:bg-white focus:bg-white "
      onClick={() => {
        onClick();
      }}
    >
      {!isOpen ? (
        <svg viewBox="0 0 18 18" fill="currentColor" height="2rem" width="2rem" className="m-auto">
          <path d="M5 3v12l10-6z" width="100%" height="100%" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 18 18"
          transform="scale(-1,1)"
          fill="currentColor"
          height="2rem"
          width="2rem"
          className="m-auto"
        >
          <path d="M5 3v12l10-6z" width="100%" height="100%" />
        </svg>
      )}
    </button>
  );
};

export default ExpandButton;
