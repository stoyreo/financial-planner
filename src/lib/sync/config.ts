export const SYNC_CONFIG = {
  localAgentUrl: "http://localhost:4455/pull",
  sseUrl: "http://localhost:4455/events",
  localDataDir: "data",
  retryMs: 2000,
  maxRetries: 5,
  version: "2.0.0",
};

export type SyncEvent =
  | { kind: "start"; total: number }
  | { kind: "progress"; pct: number; file?: string }
  | { kind: "done"; count: number; at: string }
  | { kind: "error"; message: string };
