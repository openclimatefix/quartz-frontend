import { useUser } from "@auth0/nextjs-auth0/client";
import { usePresenceClient } from "./presenceProvider";
import useGlobalState from "../helpers/globalState";
import { useEffect } from "react";

export function PresenceMetadataBridge() {
  const { user } = useUser();
  const client = usePresenceClient();
  const [view] = useGlobalState("view");
  const [nationalAggregationLevel] = useGlobalState("nationalAggregationLevel");
  const [visibleLines] = useGlobalState("visibleLines");
  const [nHourForecast] = useGlobalState("nHourForecast");
  const [showNHourView] = useGlobalState("showNHourView");
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const [selectedMapRegionIds] = useGlobalState("selectedMapRegionIds");
  const [dashboardMode] = useGlobalState("dashboardMode");

  // Sync user email (swap to userHash below when user IDs are set up)
  useEffect(() => {
    if (!client || !user?.email) return;
    client.setMeta({ email: user.email });

    // To send a hash instead of the raw email:
    // const enc = new TextEncoder().encode(user.email.trim().toLowerCase());
    // const buf = await crypto.subtle.digest("SHA-256", enc);
    // const hash = Array.from(new Uint8Array(buf))
    //   .map((b) => b.toString(16).padStart(2, "0"))
    //   .join("");
    // client.setMeta({ userHash: hash });
  }, [client, user?.email]);

  // Sync app state
  useEffect(() => {
    client?.setMeta({
      view,
      aggregation: nationalAggregationLevel,
      visibleLines,
      nHourForecast,
      showNHourView: !!showNHourView,
      selectedTime: selectedISOTime,
      selectedRegionIds: selectedMapRegionIds ?? [],
      dashboardMode
    });
  }, [
    client,
    view,
    nationalAggregationLevel,
    visibleLines,
    nHourForecast,
    showNHourView,
    selectedISOTime,
    selectedMapRegionIds,
    dashboardMode
  ]);

  return null;
}
