import "../styles/globals.css";
import { SWRConfig } from "swr";
import * as Sentry from "@sentry/nextjs";
import { AxiosError } from "axios";
import { GoogleTagManager } from "@next/third-parties/google";
import CustomUserProvider from "../components/auth/CustomUserProvider";
import { useEffect, useRef } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { PresenceProvider, usePresenceClient } from "../components/presence/presenceProvider";
import useGlobalState from "../components/helpers/globalState";

// --- Presence hook for user status ---
// function usePresence(email?: string) {
//   const wsRef = useRef<WebSocket | null>(null);
//   const heartbeatRef = useRef<number | null>(null);
//
//   useEffect(() => {
//     console.log("UE: usePresence");
//     console.log("email", email);
//     if (typeof window === "undefined") return;
//
//     let wsUrl = process.env.NEXT_PUBLIC_STATUS_URL;
//     if (!wsUrl) return;
//
//     wsUrl = wsUrl?.replace(/^http/, "ws") + "/ws";
//     console.log(`Connecting to WebSocket at ${wsUrl}`);
//
//     const ws = new WebSocket(wsUrl);
//     wsRef.current = ws;
//
//     const sendPresence = () => {
//       console.log("Sending presence");
//       if (ws.readyState !== WebSocket.OPEN) return;
//     };
//
//     ws.addEventListener("open", () => {
//       console.log("WebSocket connection opened");
//       sendPresence();
//       heartbeatRef.current = window.setInterval(sendPresence, 30_000);
//     });
//
//     ws.addEventListener("message", (event) => {
//       console.log("Received message from WebSocket", event.data);
//     });
//
//     return () => {
//       if (heartbeatRef.current) {
//         window.clearInterval(heartbeatRef.current);
//         heartbeatRef.current = null;
//       }
//       try {
//         ws.close();
//       } catch {
//         // ignore
//       }
//       wsRef.current = null;
//     };
//   }, []);
// }

function PresenceAuthBridge() {
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

function MyApp({ Component, pageProps }: any) {
  // usePresence();
  return (
    <CustomUserProvider>
      <SWRConfig
        value={{
          provider: () => new Map(),
          onError: (error: AxiosError, key) => {
            const isNetworkError = error.code === "ERR_NETWORK";
            if (
              !isNetworkError &&
              error.response?.status !== 404 &&
              error.response?.status !== 403
            ) {
              Sentry.captureException(error);
            }
            console.log("error", key, error);
          }
        }}
      >
        <PresenceProvider>
          <PresenceAuthBridge />
          <Component {...pageProps} />
          <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID || ""} />
        </PresenceProvider>
      </SWRConfig>
    </CustomUserProvider>
  );
}

export default MyApp;
