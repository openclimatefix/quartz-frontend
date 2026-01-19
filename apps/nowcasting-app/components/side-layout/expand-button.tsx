import { MdKeyboardArrowLeft } from "@react-icons/all-files/md/MdKeyboardArrowLeft";
import { MdKeyboardArrowRight } from "@react-icons/all-files/md/MdKeyboardArrowRight";
import { BiCollapseAlt, BiExpandAlt } from "react-icons/bi";
type ExpandButtonProps = { isOpen: boolean; onClick: () => void };

const ExpandButton: React.FC<ExpandButtonProps> = ({ onClick, isOpen }) => {
  return (
    <button
      className="items-center w-8 h-8 text-lg m text-black bg-amber-400 hover:bg-amber-400 focus:bg-amber-400 "
      onClick={() => {
        onClick();
      }}
    >
      {!isOpen ? (
        <BiExpandAlt className="m-auto rotate-90" />
      ) : (
        <BiCollapseAlt className="m-auto rotate-90" />
      )}
    </button>
  );
};

export default ExpandButton;
