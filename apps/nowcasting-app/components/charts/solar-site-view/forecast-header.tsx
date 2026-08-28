import { CloseButtonIcon } from "../../icons/icons";

type ForecastHeaderSiteProps = {
  title: string;
  onClose?: () => void;
  children?: React.ReactNode;
};

const ForecastHeaderSite: React.FC<ForecastHeaderSiteProps> = ({ title, onClose, children }) => {
  return (
    <div
      id="siteGroupChartHeader"
      className={"flex content-between flex-wrap bg-surface-panel h-12"}
    >
      <div
        className={`bg-surface-panel text-content text-base font-bold flex-[2] ml-5 m-auto py-2`}
      >
        {title}
      </div>
      {children}
      <button
        type="button"
        onClick={onClose}
        className="font-bold items-center px-3 text-2xl border-l-2 ml-2 border-surface-panel text-content bg-surface-panel hover:bg-content-muted focus:z-10 focus:text-content h-full"
      >
        <CloseButtonIcon />
      </button>
    </div>
  );
};

export default ForecastHeaderSite;
