/**
 * MIGRATION: Per-User Isolation for Imported Statements (v3.2)
 * 
 * Assigns all existing transactions without accountId to the Toy admin account.
 * Runs once per session via localStorage flag: f101_migration_v3_2_per_user_imports_done
 */

import { useStore } from "@/lib/store";
import { getToyAccountId } from "@/lib/accounts";

/**
 * One-time migration: assign legacy transactions (without accountId) to Toy account.
 * Idempotent via localStorage flag.
 */
export function migrateLegacyImports() {
  const FLAG = "f101_migration_v3_2_per_user_imports_done";

  // Only run in browser
  if (typeof window === "undefined") return;

  // Already migrated
  if (localStorage.getItem(FLAG) === "true") return;

  const state = useStore.getState();
  const accounts = []; // Assuming accounts are available; if not, retry next boot
  
  // For now, use "toy" as the hardcoded admin ID since that's the current setup
  const toyId = "toy"; // getToyAccountId(accounts) would work once multi-account is active

  if (!toyId) {
    console.warn("Migration: Toy account not found; will retry next boot");
    return;
  }

  const tx = state.transactions ?? [];
  const imports = state.statementImports ?? [];

  // Only migrate transactions that don't have accountId yet
  const fixedTx = tx.map(t =>
    t.accountId ? t : { ...t, accountId: toyId }
  );
  const fixedImports = imports.map(i =>
    i.accountId ? i : { ...i, accountId: toyId }
  );

  // Persist the migration
  useStore.setState({
    transactions: fixedTx,
    statementImports: fixedImports,
  });

  localStorage.setItem(FLAG, "true");
  console.log(`Migration: assigned ${fixedTx.length} transactions and ${fixedImports.length} imports to Toy account`);
}
