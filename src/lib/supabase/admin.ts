/**
 * Server-only Supabase admin client (service_role).
 * NEVER import this from a "use client" file.
 *
 * Used by:
 *   - src/app/api/admin/users/route.ts
 *   - src/app/api/sync/route.ts
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase credentials: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// ─── Row ↔ AppUser mapping (snake_case <-> camelCase) ───────────
export type AppUserRow = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: "admin" | "member" | "demo";
  data_mode: "real" | "own" | "demo";
  storage_key: string;
  created_at: string;
  last_login: string | null;
  is_active: boolean;
};

export function rowToAppUser(r: AppUserRow) {
  return {
    id: r.id,
    username: r.username,
    email: r.email,
    displayName: r.display_name,
    passwordHash: r.password_hash ?? "",
    role: r.role,
    dataMode: r.data_mode,
    storageKey: r.storage_key,
    createdAt: r.created_at,
    lastLogin: r.last_login ?? undefined,
    isActive: r.is_active,
    // legacy field name kept for older clients
    created_at: r.created_at,
  };
}

export function appUserToRow(u: any): AppUserRow {
  return {
    id: String(u.id),
    username: String(u.username),
    email: String(u.email).toLowerCase(),
    display_name: String(u.displayName ?? u.display_name ?? u.username),
    password_hash: u.passwordHash ?? u.password_hash ?? "",
    role: u.role,
    data_mode: u.dataMode ?? u.data_mode ?? "own",
    storage_key: u.storageKey ?? u.storage_key,
    created_at: u.createdAt ?? u.created_at ?? new Date().toISOString(),
    last_login: u.lastLogin ?? u.last_login ?? null,
    is_active: u.isActive !== false,
  };
}
