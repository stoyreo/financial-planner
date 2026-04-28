/**
 * ACTUALS AGGREGATION
 * ───────────────────
 * Pure helpers that turn a list of Transactions + ExpenseItem budgets into
 * the views the /expenses/actuals page needs:
 *   - month-by-category totals
 *   - budget-vs-actual gap
 *   - month-vs-month trend
 *   - prioritized cut suggestions (heuristic; AI route refines them)
 */

import type { ExpenseItem, Transaction } from "./types";
import { toMonthly } from "./utils";

/** "2026-04" key from any ISO date. */
export function ymKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Pretty month label e.g. "Apr 2026". */
export function ymLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

/** All distinct YYYY-MM months covered by the transaction set, sorted asc. */
export function listMonths(txns: Transaction[]): string[] {
  const set = new Set(txns.map(t => ymKey(t.postDate)));
  return Array.from(set).sort();
}

/**
 * Aggregate transactions for ONE month into category totals (debits only).
 * Credits/refunds reduce their category but never push it negative below 0.
 */
export function actualsByCategory(
  txns: Transaction[],
  ym: string
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txns) {
    if (ymKey(t.postDate) !== ym) continue;
    const sign = t.isCredit ? -1 : 1;
    out[t.category] = (out[t.category] ?? 0) + sign * t.amount;
  }
  // floor negatives so a refund-only month doesn't show as -X
  for (const k of Object.keys(out)) if (out[k] < 0) out[k] = 0;
  return out;
}

/** Total actual spend for a month across all categories. */
export function totalActuals(txns: Transaction[], ym: string): number {
  return Object.values(actualsByCategory(txns, ym)).reduce((s, v) => s + v, 0);
}

export interface BudgetVsActualRow {
  category: string;
  budget: number;          // monthly equivalent of all budgeted ExpenseItems in this category
  actual: number;          // sum of transactions in this category for the month
  gap: number;             // actual - budget (positive = over)
  pctUsed: number;         // actual / budget (0..>1)
  status: "ok" | "warn" | "over";
  isEssential: boolean;    // any essential item in this category
  budgetedItemIds: string[];
}

/**
 * Combine the user's ExpenseItem budgets with transaction actuals to produce
 * a per-category gap table for one month.
 */
export function budgetVsActual(
  expenses: ExpenseItem[],
  txns: Transaction[],
  ym: string
): BudgetVsActualRow[] {
  const actuals = actualsByCategory(txns, ym);

  const budgetByCat: Record<string, { amount: number; essential: boolean; ids: string[] }> = {};
  for (const e of expenses.filter(e => e.isActive)) {
    const monthly = toMonthly(e.budgetAmount ?? e.amount, e.frequency);
    if (!budgetByCat[e.category]) budgetByCat[e.category] = { amount: 0, essential: false, ids: [] };
    budgetByCat[e.category].amount += monthly;
    budgetByCat[e.category].essential = budgetByCat[e.category].essential || e.isEssential;
    budgetByCat[e.category].ids.push(e.id);
  }

  const allCats = Array.from(new Set<string>([...Object.keys(budgetByCat), ...Object.keys(actuals)]));
  const rows: BudgetVsActualRow[] = [];
  for (const cat of allCats) {
    const budget = budgetByCat[cat]?.amount ?? 0;
    const actual = actuals[cat] ?? 0;
    const gap = actual - budget;
    const pctUsed = budget > 0 ? actual / budget : actual > 0 ? Infinity : 0;
    const status: BudgetVsActualRow["status"] =
      pctUsed > 1.0 ? "over" : pctUsed >= 0.85 ? "warn" : "ok";
    rows.push({
      category: cat,
      budget,
      actual,
      gap,
      pctUsed,
      status,
      isEssential: budgetByCat[cat]?.essential ?? false,
      budgetedItemIds: budgetByCat[cat]?.ids ?? [],
    });
  }
  return rows.sort((a, b) => b.actual - a.actual);
}

export interface MonthlyTrendPoint {
  ym: string;
  label: string;
  total: number;
  byCategory: Record<string, number>;
}

/** Build a trend array for the last N months that have data. */
export function monthlyTrend(
  txns: Transaction[],
  lookbackMonths = 12
): MonthlyTrendPoint[] {
  const months = listMonths(txns).slice(-lookbackMonths);
  return months.map(ym => {
    const byCategory = actualsByCategory(txns, ym);
    const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
    return { ym, label: ymLabel(ym), total, byCategory };
  });
}

export interface CutSuggestion {
  category: string;
  currentMonthly: number;
  suggestedReduction: number;       // THB to cut per month
  reason: string;
  priority: "high" | "medium" | "low";
  isEssential: boolean;
}

/**
 * Heuristic baseline: rank categories by overage, prefer discretionary cuts,
 * and propose a 25–50% trim to bring it back to budget. The /api/expenses/
 * suggest-cuts route runs this AND asks Claude to refine + add narrative.
 */
export function heuristicCutSuggestions(
  rows: BudgetVsActualRow[],
  monthlySavingsTarget: number
): CutSuggestion[] {
  const candidates = rows
    .filter(r => r.actual > 0)
    .sort((a, b) => {
      // Discretionary over-budget categories first
      const aScore = (a.gap > 0 ? 1000 : 0) + (a.isEssential ? 0 : 500) + a.actual;
      const bScore = (b.gap > 0 ? 1000 : 0) + (b.isEssential ? 0 : 500) + b.actual;
      return bScore - aScore;
    });

  const suggestions: CutSuggestion[] = [];
  let saved = 0;
  for (const r of candidates) {
    if (saved >= monthlySavingsTarget) break;
    const trim = r.isEssential
      ? Math.min(r.actual * 0.1, Math.max(0, r.gap)) // essential: only shave overage
      : Math.min(r.actual * 0.4, monthlySavingsTarget - saved);
    if (trim < 100) continue;
    suggestions.push({
      category: r.category,
      currentMonthly: r.actual,
      suggestedReduction: Math.round(trim),
      priority: r.gap > 0 && !r.isEssential ? "high" : r.isEssential ? "low" : "medium",
      isEssential: r.isEssential,
      reason: r.gap > 0
        ? `Over budget by ${Math.round(r.gap).toLocaleString()} THB this month`
        : `Largest discretionary line — trimming ${Math.round((trim / r.actual) * 100)}% restores headroom`,
    });
    saved += trim;
  }
  return suggestions;
}
