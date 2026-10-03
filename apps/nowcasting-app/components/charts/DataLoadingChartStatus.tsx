import {
  NationalEndpointStates,
  LoadingState,
  SitesEndpointStates,
  EndpointState
} from "../types.d";
import { NationalEndpointLabel, SitesEndpointLabel } from "../endpoint-labels";
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
  const hasErrors = endpointsArray.some(([key, val]) => {
    if (typeof val === "string") return false;

    return !!val?.error;
  });
  return (
    // Inside the plot well, not hanging above it. It used to sit at `-top-4`, from when the
    // chart had no chrome of its own to collide with; the well clips its own overflow now, so
    // the chip was being cut in half by the card header above it. Top-right of the well is the
    // one corner no series reaches on a solar curve, and it is out of the cursor's way.
    <div
      className={`pointer-events-none absolute right-2 top-2 flex items-center ${
        isLoadingData || hasErrors ? "z-40" : "z-0"
      }`}
    >
      {/* The dock's card, at chip scale: the same ground, hairline and shadow the map controls
          and the display panel wear, so a transient status reads as app chrome rather than as
          something drawn on the data. */}
      <div
        className={`chart-data-loading-message pointer-events-auto relative flex cursor-default flex-row items-center justify-between gap-1.5 rounded-md border border-content/10 bg-surface-panel/95 px-2 py-1 shadow-2xl ${
          isLoadingData || hasErrors ? "" : "fade-out pointer-events-none select-none"
        }`}
      >
        {isLoadingData && <SpinnerTextInline />}
        {hasErrors && !isLoadingData && (
          <CrossInlineSmall title={"Error"} className="text-status-alert" />
        )}
        <div className="text-2xs font-semibold uppercase tracking-wider text-content-secondary">
          {isLoadingData || hasErrors ? message : "Data up-to-date"}
        </div>
        <div className="chart-data-loading-endpoints hidden absolute top-full min-w-fit right-0 items-center text-2xs pt-1">
          <div className="rounded-md border border-content/10 bg-surface-panel/95 px-2 py-1.5 shadow-2xl">
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

const StateIcon = ({ state }: { state: EndpointState }) => {
  if (state.loading || state.validating) {
    return <SpinnerTextInlineSmall title="Loading data" />;
  } else if (state.error) {
    return <CrossInlineSmall title="Failed to load data" />;
  } else if (state.hasData) {
    return <CheckInlineSmall title={"Latest data loaded"} />;
  } else {
    return <CrossInlineSmall title="No data" />;
  }
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
        <StateIcon state={state} />
      </div>
    </div>
  );
};

export default DataLoadingChartStatus;
