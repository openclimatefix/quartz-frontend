import { MdKeyboardArrowLeft } from "@react-icons/all-files/md/MdKeyboardArrowLeft";
import { MdKeyboardArrowRight } from "@react-icons/all-files/md/MdKeyboardArrowRight";

// Moved verbatim from `components/side-layout/expand-button.tsx` when the side layout became
// the floating chart. It still means the same thing — make the chart bigger or smaller — and
// it is the only split override this phase ships; the drag handle is OPEN 5.
type ExpandButtonProps = { isOpen: boolean; onClick: () => void };

const ExpandButton: React.FC<ExpandButtonProps> = ({ onClick, isOpen }) => {
  return (
    <button
      type="button"
      title={isOpen ? "Shrink the chart" : "Expand the chart"}
      aria-label={isOpen ? "Shrink the chart" : "Expand the chart"}
      aria-pressed={isOpen}
      className="items-center w-8 h-8 text-lg text-black bg-amber-400 hover:bg-amber-400 focus:bg-amber-400"
      onClick={() => {
        onClick();
      }}
    >
      {!isOpen ? (
        <MdKeyboardArrowRight size={32} className="m-auto" />
      ) : (
        <MdKeyboardArrowLeft size={32} className="m-auto" />
      )}
    </button>
  );
};

export default ExpandButton;
