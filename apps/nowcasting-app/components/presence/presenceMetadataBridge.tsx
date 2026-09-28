import { useUser } from "@auth0/nextjs-auth0/client";
import { usePresenceClient } from "./presenceProvider";
import useGlobalState, { useCountryState, useMapEncoding } from "../helpers/globalState";
import { useEffect } from "react";

export function PresenceMetadataBridge() {
  const { user } = useUser();
  const client = usePresenceClient();
  const [isSitesChart] = useGlobalState("isSitesChart");
  const encoding = useMapEncoding();
  // `PresenceMeta.view` is a free-form string for whatever's watching the presence feed
  // outside this app, not a value read back in here — so it keeps the old `VIEWS` labels
  // rather than taking on a new shape post-Wave-4, in case an external consumer matches on
  // them. Capacity adds one, "CAPACITY", beside them rather than reporting as "FORECAST".
  const view = isSitesChart ? "SOLAR SITES" : encoding.kind.toUpperCase();
  const [nationalAggregationLevel] = useCountryState("nationalAggregationLevel");
  const [visibleLines] = useGlobalState("visibleLines");
  const [nHourForecast] = useGlobalState("nHourForecast");
  const [showNHourView] = useGlobalState("showNHourView");
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const [selectedMapRegionIds] = useCountryState("selectedMapRegionIds");
  const [dashboardMode] = useGlobalState("dashboardMode");
  // The unit of the map on screen: the sites map's own on `/sites`, the dashboard mode's
  // otherwise. Two capacity units share glyphs with output ones ("MW"), which `view` resolves.
  const [sitesUnit] = useGlobalState("activeUnit");
  const mapUnit = isSitesChart ? sitesUnit : encoding.unit;

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
    if (!client) return;

    client.setMeta({
      domain: window.location.host,
      view,
      aggregation: nationalAggregationLevel,
      mapUnit,
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
    mapUnit,
    nHourForecast,
    showNHourView,
    selectedISOTime,
    selectedMapRegionIds,
    dashboardMode
  ]);

  return null;
}
