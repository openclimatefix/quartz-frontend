type PresenceMeta = {
  userHash?: string; // avoid email
  orgId?: string;
  view?: "map" | "chart";
  horizonBucket?: string;
};

export class PresenceClient {
  private ws: WebSocket | null = null;
  private meta: PresenceMeta = {};
  private heartbeatId: number | null = null;

  constructor(private wsUrl: string) {}

  connect() {
    if (this.ws || typeof window === "undefined") return;

    this.ws = new WebSocket(this.wsUrl);

    this.ws.addEventListener("open", () => {
      this.sendPresence();
      this.heartbeatId = window.setInterval(() => this.sendPresence(), 30_000);
    });

    this.ws.addEventListener("close", () => this.cleanup());
    this.ws.addEventListener("error", () => this.cleanup());
  }

  setMeta(partial: PresenceMeta) {
    this.meta = { ...this.meta, ...partial };
    this.sendPresence(); // optional: send immediately on changes
  }

  private sendPresence() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "presence", ...this.meta }));
  }

  private cleanup() {
    if (this.heartbeatId) window.clearInterval(this.heartbeatId);
    this.heartbeatId = null;
    this.ws = null;
  }

  disconnect() {
    try {
      this.ws?.close();
    } catch {}
    this.cleanup();
  }
}
