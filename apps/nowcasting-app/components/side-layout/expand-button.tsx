import { MdKeyboardArrowLeft } from "@react-icons/all-files/md/MdKeyboardArrowLeft";
import { MdKeyboardArrowRight } from "@react-icons/all-files/md/MdKeyboardArrowRight";
type ExpandButtonProps = { isOpen: boolean; onClick: () => void };

const ExpandButton: React.FC<ExpandButtonProps> = ({ onClick, isOpen }) => {
  return (
    <button
      className="items-center w-10 h-10  text-lg m text-black bg-amber-400  hover:bg-amber-400 focus:bg-amber-400 "
      onClick={() => {
        onClick();
      }}
    >
      {!isOpen ? (
        <MdKeyboardArrowRight size={40} className="m-auto" />
      ) : (
        <MdKeyboardArrowLeft size={40} className="m-auto" />
      )}
    </button>
  );
};

export default ExpandButton;
