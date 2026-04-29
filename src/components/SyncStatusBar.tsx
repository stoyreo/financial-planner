"use client";

/**
 * SYNC STATUS BAR
 * ───────────────
 * Shows progress for BOTH halves of a save:
 *   - localSyncStatus  (localStorage persistence, instant)
 *   - remoteSyncStatus (POST /api/sync → data/user-*.json, server-backed)
 *
 * Reads directly from the Zustand store, so every store mutation that
 * triggers saveUserNamespaceAsync — or every admin-user action that updates
 * the sync status setters — moves this bar in real time.
 *
 * (An older version of this file listened to SSE from http://localhost:4455,
 * an external sync agent that isn't running in most setups — that's why the
 * bar used to be stuck at 0%.)
 */

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

type Phase = "idle" | "local" | "remote" | "done" | "error";

export default function SyncStatusBar() {
  const localStatus = useStore((s) => s.localSyncStatus);
  const remoteStatus = useStore((s) => s.remoteSyncStatus);
  const lastLocal = useStore((s) => s.lastLocalSaveTime);
  const lastRemote = useStore((s) => s.lastRemoteSaveTime);
  const lastError = useStore((s) => s.lastSyncError);

  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState("Idle");
  const [visible, setVisible] = useState(false);

  // ── Derive phase + progress from store statuses ────────────────────────
  useEffect(() => {
    // Error wins
    if (localStatus === "error" || remoteStatus === "error") {
      setPhase("error");
      setPct(100);
      setMsg(lastError ?? "Sync error");
      setVisible(true);
      return;
    }

    // Local is saving → first half of the progress bar
    if (localStatus === "saving") {
      setPhase("local");
      setPct(25);
      setMsg("Saving locally…");
      setVisible(true);
      return;
    }

    // Local done, remote still going → second half
    if (remoteStatus === "saving") {
      setPhase("remote");
      setPct(70);
      setMsg("Syncing to server…");
      setVisible(true);
      return;
    }

    // Both completed (at least one recently)
    if (localStatus === "completed" || remoteStatus === "completed") {
      setPhase("done");
      setPct(100);
      setMsg(
        remoteStatus === "completed"
          ? "Synced to server ✓"
          : "Saved locally ✓",
      );
      setVisible(true);
      return;
    }

    // Truly idle — hide the bar after a short grace period
    if (localStatus === "idle" && remoteStatus === "idle") {
      const timer = setTimeout(() => setVisible(false), 800);
      setPhase("idle");
      return () => clearTimeout(timer);
    }
  }, [localStatus, remoteStatus, lastError]);

  // Auto-dismiss "done" state quickly so it doesn't keep blocking the
  // bottom-right corner of the page (statement-history trash buttons live
  // there).
  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(t);
  }, [phase]);

  // If there's never been any sync activity, stay hidden.
  if (!visible && !lastLocal && !lastRemote) return null;

  const color =
    phase === "done"
      ? "bg-green-500"
      : phase === "error"
        ? "bg-red-500"
        : "bg-blue-500";

  const lastAt =
    phase === "done" ? lastRemote ?? lastLocal : null;

  return (
    <div className="fixed bottom-4 right-4 w-80 p-3 rounded-xl shadow-lg bg-card text-card-foreground border border-border z-[60] pointer-events-none opacity-90">
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold text-foreground">Web → Database Sync</span>
        <span className="text-foreground">{pct}%</span>
      </div>

      <div className="h-2 w-full bg-muted rounded overflow-hidden">
        <div
          className={`h-2 rounded transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="text-xs mt-2 text-muted-foreground">{msg}</div>

      {/* Per-stage indicators so the user can see each half progress */}
      <div className="text-[11px] mt-1 flex justify-between text-muted-foreground">
        <span>
          Local:{" "}
          <strong
            className={
              localStatus === "completed"
                ? "text-green-600 dark:text-green-400"
                : localStatus === "error"
                  ? "text-red-600 dark:text-red-400"
                  : localStatus === "saving"
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-muted-foreground"
            }
          >
            {localStatus}
          </strong>
        </span>
        <span>
          Remote:{" "}
          <strong
            className={
              remoteStatus === "completed"
                ? "text-green-600 dark:text-green-400"
                : remoteStatus === "error"
                  ? "text-red-600 dark:text-red-400"
                  : remoteStatus === "saving"
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-muted-foreground"
            }
          >
            {remoteStatus}
          </strong>
        </span>
      </div>

      {phase === "done" && lastAt && (
        <div className="text-[11px] mt-1 text-green-600 dark:text-green-400">
          ✓ Data synced @ {new Date(lastAt).toLocaleTimeString()}
        </div>
      )}
      {phase === "error" && lastError && (
        <div className="text-[11px] mt-1 text-red-600 dark:text-red-400 break-all">
          {lastError}
        </div>
      )}
    </div>
  );
}
