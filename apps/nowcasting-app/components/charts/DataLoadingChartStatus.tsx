import {
  NationalEndpointLabel,
  NationalEndpointStates,
  LoadingState,
  SitesEndpointLabel,
  SitesEndpointStates,
  EndpointState
} from "../types.d";
import {
  CheckInlineSmall,
  ClockInlineSmall,
  CrossInlineSmall,
  SpinnerTextInline,
  SpinnerTextInlineSmall
} from "../icons/icons";
import React, { FC } from "react";
import useGlobalState from "../helpers/globalState";

const isEndpointStateType = <T extends NationalEndpointStates | SitesEndpointStates>(
  states: NationalEndpointStates | SitesEndpointStates,
  type: "national" | "sites"
): states is T => states.type === type;

const DataLoadingChartStatus = <
  EndpointStateType extends NationalEndpointStates | SitesEndpointStates
>({
  loadingState
}: {
  loadingState: LoadingState<EndpointStateType>;
}) => {
  const isLoadingData =
    !loadingState.initialLoadComplete ||
    (loadingState.showMessage && !!loadingState.message.length);
  const [showNHourView] = useGlobalState("showNHourView");

  if (!loadingState || !loadingState.endpointStates || !loadingState.endpointStates.type)
    return null;

  if (isEndpointStateType<NationalEndpointStates>(loadingState.endpointStates, "national")) {
    return (
      <EndpointStatusList<NationalEndpointStates>
        isLoadingData={isLoadingData}
        message={loadingState.message}
        endpointStates={loadingState.endpointStates}
        showNHourView={showNHourView}
      />
    );
  } else if (isEndpointStateType<SitesEndpointStates>(loadingState.endpointStates, "sites")) {
    return (
      <EndpointStatusList<SitesEndpointStates>
        message={loadingState.message}
        endpointStates={loadingState.endpointStates}
        isLoadingData={isLoadingData}
        showNHourView={showNHourView}
      />
    );
  }

  return null;
};

type EndpointStatusListProps<K> = {
  isLoadingData: boolean;
  message: string;
  endpointStates: K;
  showNHourView: boolean | undefined;
};
const EndpointStatusList = <K extends NationalEndpointStates | SitesEndpointStates>({
  isLoadingData,
  message,
  endpointStates,
  showNHourView = false
}: EndpointStatusListProps<K>) => {
  const endpointsArray = Array.from(Object.entries(endpointStates));
  return (
    <div
      className={`absolute -top-4 right-2 flex items-center h-9 ${isLoadingData ? "z-40" : "z-0"}`}
    >
      <div
        className={`chart-data-loading-message flex flex-row relative h-6 cursor-default justify-between items-center rounded-sm bg-mapbox-black  ${
          isLoadingData
            ? "pr-2 pl-1.5"
            : "bg-mapbox-black-600 px-1.5 fade-out pointer-events-none select-none"
        }`}
      >
        {!!isLoadingData && <SpinnerTextInline className="mr-2" />}
        <div className="text-sm text-ocf-gray-500">
          {isLoadingData ? message : "Data up-to-date"}
        </div>
        <div className="chart-data-loading-endpoints hidden absolute top-full min-w-fit right-0 items-center text-2xs pt-1">
          <div className="py-1.5 px-2 bg-mapbox-black rounded-sm">
            {!!endpointsArray.length &&
              endpointsArray.map(([key, val]) => {
                if (!endpointStates) return null;
                if (key === "nationalNHour" && !showNHourView) return null;
                // Filter out "type" key with string state value
                if (typeof val === "string") return null;
                const state = endpointStates[key as keyof typeof endpointStates];
                if (!state) return null;
                return <EndpointStatus key={`loading-${key}`} endpointKey={key} state={val} />;
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

const EndpointStatus: React.FC<{ endpointKey: string; state: EndpointState }> = ({
  endpointKey,
  state
}) => {
  return (
    <div className="flex flex-row whitespace-nowrap justify-between">
      {endpointKey in NationalEndpointLabel && (
        <span className="block mr-2">
          {NationalEndpointLabel[endpointKey as keyof typeof NationalEndpointLabel]}
        </span>
      )}
      {endpointKey in SitesEndpointLabel && (
        <span className="block mr-2">
          {SitesEndpointLabel[endpointKey as keyof typeof SitesEndpointLabel]}
        </span>
      )}
      <div className="flex gap-2 items-center">
        {state.loading && !state.hasData && <SpinnerTextInlineSmall title="Loading initial data" />}
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
};

export default DataLoadingChartStatus;
