import { LoadingState } from "../types";
import { SpinnerTextInline } from "../icons/icons";
import { FC } from "react";

const DataLoadingChartStatus: FC<{ loadingState: LoadingState }> = ({ loadingState }) => {
  if (!loadingState.showMessage || !loadingState.message.length) return null;

  return (
    <div className="absolute -top-4 right-4 flex items-center h-9">
      <div className="flex flex-row h-6 justify-between items-center bg-mapbox-black rounded-sm px-2 pl-1.5">
        <SpinnerTextInline className="mr-2"></SpinnerTextInline>
        <div className="text-sm text-ocf-gray-500">{loadingState.message}</div>
      </div>
    </div>
  );
};

export default DataLoadingChartStatus;
