#!/usr/bin/env node
/**
 * DEPRECATED 2026-04-20 — demo accounts have been removed from the product.
 * Running this script would push the demo user straight into Cloudflare KV and
 * resurrect an account the admin has intentionally deleted.
 *
 * Kept for historical reference only. Pass
 * `--i-really-want-to-resurrect-demo` as the last arg to override.
 */

if (!process.argv.includes("--i-really-want-to-resurrect-demo")) {
  console.error("✗ scripts/sync-demo-remote.js is deprecated.");
  console.error("  Demo accounts were removed from the product on 2026-04-20.");
  console.error("  Running this would push demo user data to Cloudflare KV.");
  console.error("  If you really want that, rerun with --i-really-want-to-resurrect-demo");
  process.exit(1);
}

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const adminHash = process.argv[2];
const shouldDeploy = process.argv[3] === "--deploy";

if (!adminHash) {
  console.error("❌ Usage: node scripts/sync-demo-remote.js <adminPasswordHash> [--deploy]");
  console.error("\nThe adminPasswordHash should be copied from the REMOTE environment's .env");
  process.exit(1);
}

const DEMO_USER = {
  id: "user_demo",
  username: "DEMO",
  email: "demo@example.com",
  displayName: "Demo User",
  passwordHash: adminHash,
  role: "demo",
  dataMode: "demo",
  storageKey: "fp_data_demo",
  createdAt: new Date().toISOString(),
  isActive: true,
};

const DEMO_PROFILE_DATA = {
  profile: {
    id: "profile_demo",
    fullName: "Demo User",
    firstName: "Demo",
    lastName: "User",
    email: "demo@example.com",
    phone: "+1-555-0100",
    addressLine1: "123 Demo Street",
    city: "Springfield",
    state: "IL",
    postalCode: "62704",
    country: "US",
    dateOfBirth: "1990-01-01",
    retirementAge: 65,
    lifeExpectancy: 90,
    currency: "USD",
    planningStartDate: new Date().toISOString().split("T")[0],
    maritalStatus: "Single",
    riskProfile: "moderate",
    targetMinCashBalance: 50000,
    emergencyFundTargetMonths: 6,
    currentCashBalance: 25000,
    notes: "Demo account for testing",
  },
  incomes: [],
  expenses: [],
  debts: [],
  investments: [],
  retirement: {
    retirementAge: 65,
    expectedAnnualExpense: 480000,
    inflationRate: 0.03,
    portfolioReturnPreRetirement: 0.07,
    portfolioReturnDuringRetirement: 0.05,
    safeWithdrawalRate: 0.04,
    pensionMonthlyAmount: 0,
    ssoMonthlyBenefit: 0,
  },
  tax: {
    annualGrossIncome: 0,
    personalDeduction: 0,
    employmentIncomeDeduction: 0,
    pvdContribution: 0,
    rmfContribution: 0,
    ssfContribution: 0,
    lifeInsurancePremium: 0,
    healthInsurancePremium: 0,
    mortgageInterestDeduction: 0,
    parentalDeduction: 0,
    childDeduction: 0,
    otherDeductions: 0,
    annualBonus: 0,
  },
  scenarios: [],
  activeScenarioId: "base",
};

async function syncDemoRemote() {
  console.log("☁️  Syncing DEMO user to Cloudflare KV (Remote)...\n");

  // Save to local JSON for reference
  const localUserFile = path.join(__dirname, "../data/remote-demo-user.json");
  const localProfileFile = path.join(__dirname, "../data/remote-demo-profile.json");

  fs.writeFileSync(localUserFile, JSON.stringify(DEMO_USER, null, 2));
  fs.writeFileSync(localProfileFile, JSON.stringify(DEMO_PROFILE_DATA, null, 2));

  console.log(`✅ Saved remote DEMO user reference to ${localUserFile}`);
  console.log(`✅ Saved remote DEMO profile reference to ${localProfileFile}`);

  console.log("\n📋 DEMO User (to be synced to KV):");
  const redactedUser = { ...DEMO_USER, passwordHash: "<redacted>" };
  console.log(JSON.stringify(redactedUser, null, 2));

  console.log("\n📋 DEMO Profile Data (to be synced to KV):");
  console.log(JSON.stringify(DEMO_PROFILE_DATA, null, 2));

  if (shouldDeploy) {
    console.log("\n🚀 Deploying to Cloudflare KV...");
    try {
      // This would use wrangler KV commands
      console.log("   Note: Wrangler KV sync requires authentication and namespace ID");
      console.log("   Commands to run manually:");
      console.log(`\n   # Set the user registry (merge with existing)`);
      console.log(`   wrangler kv:key put --namespace-id=<ID> fp_users_v1 '<USERS_JSON>'`);
      console.log(`\n   # Set the profile data`);
      console.log(`   wrangler kv:key put --namespace-id=<ID> fp_data_demo '<PROFILE_JSON>'`);
    } catch (error) {
      console.error("❌ Deployment failed:", error.message);
      process.exit(1);
    }
  } else {
    console.log("\n💡 To deploy to Cloudflare KV, run:");
    console.log(`   node scripts/sync-demo-remote.js "${adminHash}" --deploy`);
  }

  console.log("\n✅ Remote DEMO user preparation complete!");
}

syncDemoRemote().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
