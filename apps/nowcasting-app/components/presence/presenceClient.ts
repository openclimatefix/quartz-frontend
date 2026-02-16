export type PresenceMeta = {
  email?: string;
  userHash?: string;
  view?: string;
  aggregation?: string;
  visibleLines?: string[];
  nHourForecast?: number;
  showNHourView?: boolean;
  selectedTime?: string;
  selectedRegionIds?: string[];
  dashboardMode?: boolean;
};

export class PresenceClient {
  private ws: WebSocket | null = null;
  private meta: PresenceMeta = {};
  private heartbeatId: number | null = null;
  private reconnectId: number | null = null;
  private active = false;

  constructor(private wsUrl: string) {}

  connect() {
    if (this.ws || typeof window === "undefined") return;

    this.active = true;
    this.ws = new WebSocket(this.wsUrl);

    this.ws.addEventListener("open", () => {
      console.log("[presence] connected");
      this.sendPresence();
      this.heartbeatId = window.setInterval(() => this.sendPresence(), 5_000);
    });

    this.ws.addEventListener("close", () => this.handleDisconnect());
    this.ws.addEventListener("error", () => this.handleDisconnect());
  }

  setMeta(partial: PresenceMeta) {
    this.meta = { ...this.meta, ...partial };
    this.sendPresence();
  }

  private sendPresence() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "presence", ...this.meta }));
  }

  private handleDisconnect() {
    this.cleanup();
    if (this.active) {
      console.log("[presence] disconnected, retrying in 5s");
      this.reconnectId = window.setTimeout(() => {
        this.reconnectId = null;
        this.connect();
      }, 5_000);
    }
  }

  private cleanup() {
    if (this.heartbeatId) window.clearInterval(this.heartbeatId);
    this.heartbeatId = null;
    this.ws = null;
  }

  disconnect() {
    this.active = false;
    if (this.reconnectId) window.clearTimeout(this.reconnectId);
    this.reconnectId = null;
    try {
      this.ws?.close();
    } catch {}
    this.cleanup();
  }
}
