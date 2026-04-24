"use client";

import { useStore } from "@/lib/store";
import { Clock, CheckCircle, AlertTriangle } from "lucide-react";

/**
 * SYNC STATUS BADGE
 * ──────────────────
 * Displays local and remote sync status in fixed bottom-right corner.
 * Shows: Local: {icon} {label}, Cloud: {icon} {label}
 * Only renders if there's activity or errors.
 */
export function SyncStatusBadge() {
  const {
    localSyncStatus,
    remoteSyncStatus,
    lastLocalSaveTime,
    lastRemoteSaveTime,
  } = useStore();

  // Hide badge if both idle and no save times
  if (
    localSyncStatus === "idle" &&
    remoteSyncStatus === "idle" &&
    lastLocalSaveTime === null &&
    lastRemoteSaveTime === null
  ) {
    return null;
  }

  const formatTime = (isoString: string | null) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  const getStatusIcon = (status: string) => {
    if (status === "saving") {
      return <Clock size={14} className="animate-spin text-amber-500" />;
    }
    if (status === "completed") {
      return <CheckCircle size={14} className="text-emerald-500" />;
    }
    if (status === "error") {
      return <AlertTriangle size={14} className="text-red-500" />;
    }
    return null;
  };

  const getStatusLabel = (status: string, lastSaveTime: string | null) => {
    if (status === "saving") return "Saving…";
    if (status === "completed" && lastSaveTime) return `Saved ${formatTime(lastSaveTime)}`;
    if (status === "completed") return "Saved";
    if (status === "error") return "Error";
    return "Idle";
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
      {/* Local sync */}
      <div className="flex items-center gap-2 text-foreground">
        <span className="font-medium">Local:</span>
        {getStatusIcon(localSyncStatus)}
        <span>{getStatusLabel(localSyncStatus, lastLocalSaveTime)}</span>
      </div>

      {/* Remote sync */}
      <div className="flex items-center gap-2 text-foreground">
        <span className="font-medium">Cloud:</span>
        {getStatusIcon(remoteSyncStatus)}
        <span>{getStatusLabel(remoteSyncStatus, lastRemoteSaveTime)}</span>
      </div>
    </div>
  );
}
