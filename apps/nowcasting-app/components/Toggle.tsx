import { FC } from "react";

const Toggle: FC<{
  onClick: () => void;
  visible: boolean;
}> = ({ onClick, visible }) => {
  return (
    <label className="inline-flex items-center cursor-pointer px-1 ml-2">
      <input type="checkbox" checked={visible} onChange={onClick} className={`toggle`}></input>
    </label>
  );
};

export default Toggle;
