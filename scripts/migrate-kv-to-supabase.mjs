#!/usr/bin/env node
/**
 * ONE-TIME MIGRATION
 * ──────────────────
 * Reads the live registry + per-user data from the Cloudflare Pages
 * deploy (still KV-backed at the moment this script is run) and writes
 * them into Supabase via service-role PostgREST.
 *
 * Usage:
 *   CF_BASE_URL=https://financeplan-th.pages.dev \
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node scripts/migrate-kv-to-supabase.mjs
 *
 * Idempotent: uses upsert semantics on both tables.
 */

const CF = process.env.CF_BASE_URL;
const SB = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CF || !SB || !SK) {
  console.error("Missing env. Need: CF_BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sbHeaders = (extra = {}) => ({
  apikey: SK,
  Authorization: `Bearer ${SK}`,
  "Content-Type": "application/json",
  ...extra,
});

function toRow(u) {
  return {
    id: String(u.id),
    username: String(u.username),
    email: String(u.email).toLowerCase(),
    display_name: String(u.displayName ?? u.username),
    password_hash: u.passwordHash ?? "",
    role: u.role,
    data_mode: u.dataMode ?? "own",
    storage_key: u.storageKey,
    created_at: u.createdAt ?? new Date().toISOString(),
    last_login: u.lastLogin ?? null,
    is_active: u.isActive !== false,
  };
}

async function main() {
  // 1. Pull the user registry from the still-KV-backed CF endpoint.
  //    IMPORTANT: run this script BEFORE you flip Cloudflare to the
  //    Supabase-backed function (§3.4) — otherwise both sides are empty.
  console.log(`[1/3] GET ${CF}/api/admin/users`);
  const regRes = await fetch(`${CF}/api/admin/users`);
  if (!regRes.ok) throw new Error(`registry fetch failed ${regRes.status}`);
  const { users } = await regRes.json();
  console.log(`     → ${users.length} users`);

  // 2. Upsert all users into Supabase.
  console.log(`[2/3] upsert ${users.length} rows into app_users`);
  const rows = users.map(toRow);
  const up = await fetch(`${SB}/rest/v1/app_users?on_conflict=id`, {
    method: "POST",
    headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(rows),
  });
  if (!up.ok) throw new Error(`app_users upsert ${up.status}: ${await up.text()}`);

  // 3. Pull each user's data blob from CF, upsert into user_data.
  console.log(`[3/3] migrating per-user data`);
  let moved = 0;
  let missing = 0;
  for (const u of users) {
    if (!u.storageKey) continue;
    const dRes = await fetch(`${CF}/api/sync?storageKey=${encodeURIComponent(u.storageKey)}`);
    if (dRes.status === 404) {
      missing++;
      continue;
    }
    if (!dRes.ok) {
      console.warn(`     ! skip ${u.storageKey}: sync GET ${dRes.status}`);
      continue;
    }
    const { data } = await dRes.json();
    const up2 = await fetch(`${SB}/rest/v1/user_data?on_conflict=storage_key`, {
      method: "POST",
      headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        storage_key: u.storageKey,
        data,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!up2.ok) {
      console.warn(`     ! skip ${u.storageKey}: supabase upsert ${up2.status}: ${await up2.text()}`);
      continue;
    }
    moved++;
    console.log(`     ✓ ${u.username} (${u.storageKey})`);
  }

  console.log(`\nDone. users=${users.length}  data_moved=${moved}  data_missing=${missing}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
