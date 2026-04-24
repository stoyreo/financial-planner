#!/usr/bin/env node
/**
 * DEPRECATED 2026-04-20 — demo accounts have been removed from the product.
 * Running this script would re-push the demo user to the local/remote registry
 * and resurrect an account the admin has intentionally deleted.
 *
 * The file is kept for historical reference only. Pass
 * `--i-really-want-to-resurrect-demo` as the last arg to override.
 */

if (!process.argv.includes("--i-really-want-to-resurrect-demo")) {
  console.error("✗ scripts/add-demo-user.js is deprecated.");
  console.error("  Demo accounts were removed from the product on 2026-04-20.");
  console.error("  Running this would re-push the demo user to the registry.");
  console.error("  If you really want that, rerun with --i-really-want-to-resurrect-demo");
  process.exit(1);
}

const fs = require("fs");
const path = require("path");

const adminHash = process.argv[2];
const environment = process.argv[3] || "local";

if (!adminHash) {
  console.error("❌ Usage: node scripts/add-demo-user.js <adminPasswordHash> [local|remote]");
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

function addDemoUserLocal() {
  console.log("📝 Adding DEMO user to LOCAL environment (localStorage simulation)...");

  const dataFile = path.join(__dirname, "../data/users-registry.json");
  const profileFile = path.join(__dirname, "../data/user-fp_data_demo.json");

  // Ensure data directory exists
  const dataDir = path.dirname(dataFile);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write user registry
  let registry = [];
  if (fs.existsSync(dataFile)) {
    const content = fs.readFileSync(dataFile, "utf-8");
    registry = JSON.parse(content);
  }

  // Remove DEMO if exists (idempotent)
  registry = registry.filter(u => u.id !== "user_demo");
  registry.push(DEMO_USER);

  fs.writeFileSync(dataFile, JSON.stringify(registry, null, 2));
  console.log(`✅ Wrote DEMO user to ${dataFile}`);

  // Write profile data
  fs.writeFileSync(profileFile, JSON.stringify(DEMO_PROFILE_DATA, null, 2));
  console.log(`✅ Wrote DEMO profile data to ${profileFile}`);

  // Display redacted output
  const redacted = { ...DEMO_USER, passwordHash: "<redacted>" };
  console.log("\n📋 DEMO User (LOCAL):");
  console.log(JSON.stringify(redacted, null, 2));
}

function addDemoUserRemote() {
  console.log("📝 Adding DEMO user to REMOTE environment (Cloudflare KV)...");
  console.log("⚠️  For production Cloudflare KV, use wrangler KV:key put");
  console.log("   Command: wrangler kv:key put --namespace-id=<ID> user_demo '<JSON>'");

  const redacted = { ...DEMO_USER, passwordHash: "<redacted>" };
  console.log("\n📋 DEMO User (REMOTE - KV):");
  console.log(JSON.stringify(redacted, null, 2));

  console.log("\n📋 DEMO Profile Data (REMOTE - KV):");
  console.log(JSON.stringify(DEMO_PROFILE_DATA, null, 2));
}

if (environment === "local") {
  addDemoUserLocal();
} else if (environment === "remote") {
  addDemoUserRemote();
} else {
  console.error(`❌ Unknown environment: ${environment}`);
  process.exit(1);
}

console.log("\n✅ DEMO user setup complete!");
