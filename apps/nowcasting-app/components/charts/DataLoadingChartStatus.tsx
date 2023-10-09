import { EndpointStates, LoadingState, SitesEndpointStates } from "../types";
import {
  CheckInlineSmall,
  ClockInlineSmall,
  CrossInlineSmall,
  SpinnerTextInline,
  SpinnerTextInlineSmall
} from "../icons/icons";
import React, { FC } from "react";
import useGlobalState from "../helpers/globalState";

const DataLoadingChartStatus: FC<{
  loadingState: LoadingState<EndpointStates | SitesEndpointStates>;
}> = ({ loadingState }) => {
  const isLoadingData =
    !loadingState.initialLoadComplete || (loadingState.showMessage && loadingState.message.length);
  const loadingEndpoints = Object.entries(
    loadingState?.endpointStates || ({} as LoadingState<EndpointStates | SitesEndpointStates>)
  );
  const [show4hView] = useGlobalState("show4hView");

  return (
    <div className="absolute -top-4 right-4 flex items-center h-9 z-50">
      <div
        className={`chart-data-loading-message flex flex-row relative h-6 cursor-default justify-between items-center rounded-sm bg-mapbox-black  ${
          isLoadingData ? "pr-2 pl-1.5" : "bg-opacity-25 px-1.5"
        }`}
      >
        {!!isLoadingData && <SpinnerTextInline className="mr-2"></SpinnerTextInline>}
        <div className="text-sm text-ocf-gray-500">
          {isLoadingData ? loadingState.message : "Data up-to-date"}
        </div>
        <div className="chart-data-loading-endpoints hidden absolute top-full min-w-fit right-0 items-center text-2xs pt-1">
          <div className="py-1.5 px-2 bg-mapbox-black rounded-sm">
            {!!loadingEndpoints.length &&
              loadingEndpoints.map(([key, state]) => {
                if (key === "national4Hour" && !show4hView) return null;
                return (
                  <div key={`loading-${key}`} className="flex flex-row justify-between">
                    <span className="block mr-2">{key}</span>
                    <div className="flex gap-2 items-center">
                      {state.loading && !state.hasData && (
                        <SpinnerTextInlineSmall title="Loading initial data" />
                      )}
                      {state.hasData && <CheckInlineSmall title={"Initial data loaded"} />}
                      {!state.loading && !state.hasData ? (
                        <>
                          <CrossInlineSmall title="Failed to load data" />
                          <CrossInlineSmall title="Failed to load data" />
                        </>
                      ) : state.validating ? (
                        state.loading ? (
                          <ClockInlineSmall title="Waiting for initial data" />
                        ) : (
                          <SpinnerTextInlineSmall title="Fetching updated data" />
                        )
                      ) : (
                        <CheckInlineSmall title="Data up-to-date" />
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataLoadingChartStatus;
