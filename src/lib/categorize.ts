/**
 * MERCHANT CATEGORIZATION
 * ───────────────────────
 * Two-pass categorization:
 *   1. Deterministic rule match against merchantKey (substring, case-insensitive)
 *   2. Caller falls back to AI for unmatched transactions
 *
 * Default rules cover ~80% of common Thai consumer merchants seen on UOB,
 * KBank, SCB, KTC and TrueMoney statements. Additional rules are appended
 * each time the user re-categorizes a transaction in the UI.
 */

import { v4 as uuid } from "uuid";
import type { MerchantRule, Transaction } from "./types";

export const BUDGET_CATEGORIES = [
  "Utilities", "Food", "Transport", "Insurance", "Housing",
  "Entertainment", "Shopping", "Travel", "Family", "Pet",
  "Health", "Investment", "Medical", "Other",
] as const;

export type BudgetCategory = typeof BUDGET_CATEGORIES[number];

/** Normalize a raw merchant description into a stable key for pattern matching. */
export function toMerchantKey(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9 .*&\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Default merchant→category rules covering the UOB sample statement. */
export const DEFAULT_MERCHANT_RULES: Omit<MerchantRule, "id" | "createdAt">[] = [
  // ── Transport ──────────────────────────────────────────
  { pattern: "WWW.GRAB.COM", category: "Transport", source: "default", hits: 0, isEssential: true },
  { pattern: "GRABTAXI", category: "Transport", source: "default", hits: 0, isEssential: true },
  { pattern: "MRT-BEM", category: "Transport", source: "default", hits: 0, isEssential: true },
  { pattern: "LP_BTS", category: "Transport", source: "default", hits: 0, isEssential: true },
  { pattern: "BTS", category: "Transport", source: "default", hits: 0, isEssential: true },
  { pattern: "SHELL", category: "Transport", source: "default", hits: 0, isEssential: true },
  { pattern: "PTT STATION", category: "Transport", source: "default", hits: 0, isEssential: true },
  { pattern: "BANGCHAK", category: "Transport", source: "default", hits: 0, isEssential: true },
  { pattern: "ESSO", category: "Transport", source: "default", hits: 0, isEssential: true },

  // ── Food / Groceries / Dining ──────────────────────────
  { pattern: "TOPS-", category: "Food", source: "default", hits: 0, isEssential: true },
  { pattern: "BIG C", category: "Food", source: "default", hits: 0, isEssential: true },
  { pattern: "TESCO", category: "Food", source: "default", hits: 0, isEssential: true },
  { pattern: "LOTUS", category: "Food", source: "default", hits: 0, isEssential: true },
  { pattern: "VILLA MARKET", category: "Food", source: "default", hits: 0, isEssential: true },
  { pattern: "MAKRO", category: "Food", source: "default", hits: 0, isEssential: true },
  { pattern: "GOURMET MARKET", category: "Food", source: "default", hits: 0, isEssential: true },
  { pattern: "7-11", category: "Food", source: "default", hits: 0, isEssential: true },
  { pattern: "TMN 7-11", category: "Food", source: "default", hits: 0, isEssential: true },
  { pattern: "FAMILYMART", category: "Food", source: "default", hits: 0, isEssential: true },
  { pattern: "TMN FAST FOOD", category: "Food", source: "default", hits: 0, isEssential: true },
  { pattern: "LINEPAY*PF_LINE MAN", category: "Food", source: "default", hits: 0, isEssential: false },
  { pattern: "LPTH*PF_LM", category: "Food", source: "default", hits: 0, isEssential: false },
  { pattern: "FOODPANDA", category: "Food", source: "default", hits: 0, isEssential: false },
  { pattern: "GRABFOOD", category: "Food", source: "default", hits: 0, isEssential: false },
  { pattern: "SUSHIRO", category: "Food", source: "default", hits: 0, isEssential: false },
  { pattern: "HOT POT MAN", category: "Food", source: "default", hits: 0, isEssential: false },
  { pattern: "HUMP ZAAB", category: "Food", source: "default", hits: 0, isEssential: false },
  { pattern: "KHUMSAKUL COFFEE", category: "Food", source: "default", hits: 0, isEssential: false },
  { pattern: "WAKO", category: "Food", source: "default", hits: 0, isEssential: false },
  { pattern: "MK ", category: "Food", source: "default", hits: 0, isEssential: false },
  { pattern: "STARBUCKS", category: "Food", source: "default", hits: 0, isEssential: false },
  { pattern: "AFTER YOU", category: "Food", source: "default", hits: 0, isEssential: false },

  // ── Shopping ───────────────────────────────────────────
  { pattern: "FOR SHOPEE", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "SHOPEEPAY", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "SHOPEETH", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "LAZADA", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "TIKTOK SHOP", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "OMISE*TIKTOK", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "PAYPAL *EBAY", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "FP:PAYPAL *EBAY", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "AMAZON", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "THE MALL", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "VELA-", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "CENTRAL", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "EMPORIUM", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "ICONSIAM", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "UNIQLO", category: "Shopping", source: "default", hits: 0, isEssential: false },
  { pattern: "MUJI", category: "Shopping", source: "default", hits: 0, isEssential: false },

  // ── Utilities (subscriptions, telecom, Wi-Fi) ───────────
  { pattern: "TMN TRUEBILL", category: "Utilities", source: "default", hits: 0, isEssential: true },
  { pattern: "AMP*AIS SERVICES", category: "Utilities", source: "default", hits: 0, isEssential: true },
  { pattern: "AIS", category: "Utilities", source: "default", hits: 0, isEssential: true },
  { pattern: "DTAC", category: "Utilities", source: "default", hits: 0, isEssential: true },
  { pattern: "TRUE MOVE", category: "Utilities", source: "default", hits: 0, isEssential: true },
  { pattern: "MEA ", category: "Utilities", source: "default", hits: 0, isEssential: true },
  { pattern: "MWA ", category: "Utilities", source: "default", hits: 0, isEssential: true },

  // ── Entertainment / Streaming / Software ────────────────
  { pattern: "APPLE.COM/BILL", category: "Entertainment", source: "default", hits: 0, isEssential: false },
  { pattern: "NETFLIX", category: "Entertainment", source: "default", hits: 0, isEssential: false },
  { pattern: "SPOTIFY", category: "Entertainment", source: "default", hits: 0, isEssential: false },
  { pattern: "YOUTUBE", category: "Entertainment", source: "default", hits: 0, isEssential: false },
  { pattern: "DISNEY", category: "Entertainment", source: "default", hits: 0, isEssential: false },
  { pattern: "ANTHROPIC", category: "Entertainment", source: "default", hits: 0, isEssential: false },
  { pattern: "CLAUDE.AI", category: "Entertainment", source: "default", hits: 0, isEssential: false },
  { pattern: "OPENAI", category: "Entertainment", source: "default", hits: 0, isEssential: false },
  { pattern: "GITHUB", category: "Entertainment", source: "default", hits: 0, isEssential: false },
  { pattern: "MAJOR CINEPLEX", category: "Entertainment", source: "default", hits: 0, isEssential: false },

  // ── Health / Wellness ──────────────────────────────────
  { pattern: "EVOLUTION WELLNESS", category: "Health", source: "default", hits: 0, isEssential: false },
  { pattern: "FITNESS", category: "Health", source: "default", hits: 0, isEssential: false },
  { pattern: "VIRGIN ACTIVE", category: "Health", source: "default", hits: 0, isEssential: false },
  { pattern: "COWAY", category: "Health", source: "default", hits: 0, isEssential: false },

  // ── Medical ───────────────────────────────────────────
  { pattern: "SIRIRAJ", category: "Medical", source: "default", hits: 0, isEssential: true },
  { pattern: "BUMRUNGRAD", category: "Medical", source: "default", hits: 0, isEssential: true },
  { pattern: "BANGKOK HOSPITAL", category: "Medical", source: "default", hits: 0, isEssential: true },
  { pattern: "WATSONS", category: "Medical", source: "default", hits: 0, isEssential: true },
  { pattern: "BOOTS", category: "Medical", source: "default", hits: 0, isEssential: true },

  // ── Insurance ─────────────────────────────────────────
  { pattern: "AIATH AUTO PAYMENT", category: "Insurance", source: "default", hits: 0, isEssential: true },
  { pattern: "AIA ", category: "Insurance", source: "default", hits: 0, isEssential: true },
  { pattern: "MUANG THAI LIFE", category: "Insurance", source: "default", hits: 0, isEssential: true },
  { pattern: "ALLIANZ", category: "Insurance", source: "default", hits: 0, isEssential: true },
  { pattern: "GENERALI", category: "Insurance", source: "default", hits: 0, isEssential: true },

  // ── Housing ───────────────────────────────────────────
  { pattern: "HCB00014", category: "Housing", source: "default", hits: 0, isEssential: true },
  { pattern: "Q CHANG", category: "Housing", source: "default", hits: 0, isEssential: true },
  { pattern: "WWW.2C2P.COM*Q CHANG", category: "Housing", source: "default", hits: 0, isEssential: true },
  { pattern: "HOMEPRO", category: "Housing", source: "default", hits: 0, isEssential: true },
  { pattern: "IKEA", category: "Housing", source: "default", hits: 0, isEssential: false },

  // ── Other / Misc ──────────────────────────────────────
  { pattern: "WWW.2C2P.COM", category: "Other", source: "default", hits: 0, isEssential: false },
  { pattern: "OMISE", category: "Other", source: "default", hits: 0, isEssential: false },
  { pattern: "PAYMENT THANK YOU", category: "Other", source: "default", hits: 0, isEssential: false },
];

/**
 * Match a merchant key against the rule list. Returns the BEST (longest)
 * matching rule so that more-specific patterns win over generic ones.
 */
export function matchRule(
  merchantKey: string,
  rules: MerchantRule[]
): MerchantRule | null {
  const key = merchantKey.toUpperCase();
  let best: MerchantRule | null = null;
  for (const r of rules) {
    if (key.includes(r.pattern.toUpperCase())) {
      if (!best || r.pattern.length > best.pattern.length) best = r;
    }
  }
  return best;
}

/** Build a fresh MerchantRule with id+createdAt populated. */
export function newMerchantRule(
  pattern: string,
  category: string,
  source: MerchantRule["source"] = "user",
  isEssential?: boolean
): MerchantRule {
  return {
    id: uuid(),
    pattern: pattern.toUpperCase().trim(),
    category,
    source,
    hits: 0,
    isEssential,
    createdAt: new Date().toISOString(),
  };
}

/** Build the seed default rules with id+createdAt. */
export function buildDefaultMerchantRules(): MerchantRule[] {
  const now = new Date().toISOString();
  return DEFAULT_MERCHANT_RULES.map(r => ({
    ...r,
    id: uuid(),
    createdAt: now,
  }));
}

/**
 * Apply rules to a list of partial transactions (just merchantKey + tentative
 * category from AI). Rule match wins over AI suggestion. Returns categorized
 * txns plus the list of merchant keys that nothing matched (so the caller can
 * ask the AI for help on those).
 */
export function categorizeTransactions(
  txns: Transaction[],
  rules: MerchantRule[]
): { categorized: Transaction[]; unmatched: string[] } {
  const unmatched: string[] = [];
  const categorized = txns.map(t => {
    const rule = matchRule(t.merchantKey, rules);
    if (rule) {
      return { ...t, category: rule.category, confidence: 1 };
    }
    if (!t.category || t.category === "Other") unmatched.push(t.merchantKey);
    return t;
  });
  return { categorized, unmatched: Array.from(new Set(unmatched)) };
}

/**
 * Build a deterministic fingerprint for a transaction. Re-importing the same
 * statement (or an overlapping one) will produce identical keys, letting the
 * store skip duplicates while keeping ALL historical statements on file.
 *
 * Field choice: amount + dates + cardLast4 + normalized merchant. These five
 * collide ~never in real usage and survive whitespace/case differences.
 */
export function buildDedupeKey(t: {
  billingMonth: string;
  postDate: string;
  transDate: string;
  amount: number;
  isCredit: boolean;
  cardLast4?: string;
  merchantKey: string;
}): string {
  const sign = t.isCredit ? "C" : "D";
  const card = (t.cardLast4 ?? "").padStart(4, "0");
  const amt = Math.round(t.amount * 100); // cents to avoid float jitter
  return [
    t.billingMonth,
    t.postDate,
    t.transDate,
    card,
    sign,
    amt,
    t.merchantKey,
  ].join("|");
}

/** YYYY-MM key from any ISO date — duplicated here to avoid an actuals.ts import cycle. */
export function billingMonthFrom(iso: string): string {
  return iso.slice(0, 7);
}
