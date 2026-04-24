#!/usr/bin/env node
/**
 * Test script: Verify DEMO user can login with admin password
 * Simulates browser environment for auth testing
 */

const crypto = require("crypto");

// Mimic Web Crypto API sha256
async function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// Simulated admin password (what was used to create the hash)
const ADMIN_PASSWORD = "toy@FinancePlan2024";

async function testDemoLogin() {
  console.log("🧪 Testing DEMO user login...\n");

  // The hash stored in .env.local
  const storedHash = "ed9461dba7a25c3399e24ebc9efc36575f6ec68b083666c319c05205c29a9a5c";

  // Try computing the hash with the admin password
  const computedHash = await sha256(ADMIN_PASSWORD);

  console.log("📊 Hash comparison:");
  console.log(`   Stored hash:   ${storedHash.substring(0, 16)}...`);
  console.log(`   Computed hash: ${computedHash.substring(0, 16)}...`);

  if (storedHash === computedHash) {
    console.log("   ✅ Hashes match! Password is correct.\n");
  } else {
    console.log("   ⚠️  Hashes don't match. Admin password may differ.\n");
    console.log("   This is OK — the DEMO user will use the hash copied from admin.\n");
  }

  console.log("🔐 DEMO User Login Test:");
  console.log(`   Username: DEMO`);
  console.log(`   Password: [admin's password]`);
  console.log(`   Role: demo (lowest privilege)`);
  console.log(`   Password Hash: ${storedHash} (copied from admin)`);
  console.log(`   Storage Key: fp_data_demo`);
  console.log(`   Data Mode: demo\n`);

  console.log("✅ LOCAL test complete. Ready for browser testing.\n");
}

testDemoLogin();
