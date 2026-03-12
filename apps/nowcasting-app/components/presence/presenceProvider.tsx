import React, { createContext, useContext, useEffect, useMemo } from "react";
import { PresenceClient } from "./presenceClient";

const PresenceContext = createContext<PresenceClient | null>(null);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const statusUrl = process.env.NEXT_PUBLIC_STATUS_URL;
  const wsUrl = statusUrl ? statusUrl.replace(/^http/, "ws") + "/ws" : "";

  const client = useMemo(() => (wsUrl ? new PresenceClient(wsUrl) : null), [wsUrl]);

  useEffect(() => {
    client?.connect();
    return () => client?.disconnect();
  }, [client]);

  return <PresenceContext.Provider value={client}>{children}</PresenceContext.Provider>;
}

export function usePresenceClient() {
  const client = useContext(PresenceContext);
  return client;
}
