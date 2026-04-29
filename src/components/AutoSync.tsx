"use client";

/**
 * AUTO-SYNC
 * ---------
 * Subscribes to the Zustand store and, whenever any of the data slices
 * changes (profile / incomes / expenses / debts / investments /
 * retirement / tax / scenarios / activeScenarioId / transactions /
 * merchantRules / statementImports), debounces for a short period and
 * then calls saveUserNamespaceAsync() so the change is persisted both
 * to localStorage AND to the server file (data/user-*.json).
 *
 * This is what makes "every field edit on the web actually reflected to the
 * database" -- without having to sprinkle save() calls on every page.
 *
 * It also drives the <SyncStatusBar />, because saveUserNamespaceAsync flips
 * localSyncStatus / remoteSyncStatus on the store as it runs.
 */

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { getSession } from "@/lib/auth";

const DEBOUNCE_MS = 800;

export default function AutoSync() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRunRef = useRef(true);

  useEffect(() => {
    // Subscribe to the fields we want to persist. Zustand calls this on
    // EVERY store update; we hash a signature and skip no-ops.
    const unsub = useStore.subscribe((state, prev) => {
      // Skip the initial hydration pass -- we don't want to sync the
      // just-loaded state back to the server.
      if (firstRunRef.current) {
        firstRunRef.current = false;
        return;
      }

      // Only run if a data-bearing slice actually changed. Ignore
      // forecast recomputes and sync-status flips.
      //
      // IMPORTANT: transactions / merchantRules / statementImports MUST be
      // included here. Otherwise an "Import Statement" on /expenses/actuals
      // updates state but never syncs to the server, and the next
      // loadUserNamespace() call (fired by AuthGuard) overwrites the
      // just-imported transactions with the stale remote payload.
      const dataChanged =
        state.profile !== prev.profile ||
        state.incomes !== prev.incomes ||
        state.expenses !== prev.expenses ||
        state.debts !== prev.debts ||
        state.investments !== prev.investments ||
        state.retirement !== prev.retirement ||
        state.tax !== prev.tax ||
        state.scenarios !== prev.scenarios ||
        state.activeScenarioId !== prev.activeScenarioId ||
        state.transactions !== prev.transactions ||
        state.merchantRules !== prev.merchantRules ||
        state.statementImports !== prev.statementImports;

      if (!dataChanged) return;
      if (!getSession()) return; // not logged in -> nothing to save

      // Debounce: coalesce a burst of edits into one save.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        useStore.getState().saveUserNamespaceAsync().catch((err) => {
          console.error("[AutoSync] save failed", err);
        });
      }, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return null;
}
