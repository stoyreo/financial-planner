/**
 * Local (offline) Savings Cuts engine.
 *
 * Same output contract as POST /api/expenses/suggest-cuts so the UI can
 * render either result with one component. No network, no Anthropic, no API
 * key — pure deterministic logic over budget-vs-actual rows.
 *
 * Algorithm (greedy):
 *   1. Compute savings gap = max(0, target - currentSavings).
 *   2. Rank categories: discretionary first, then over-budget essentials.
 *      Within each tier, larger actual spend ranks higher (more headroom).
 *   3. For each category, the *max cut* is:
 *        - discretionary: up to 50% of actual
 *        - essential:     only the overage (actual - budget) if > 0, else 0
 *   4. Walk the ranked list, taking min(maxCut, remainingNeed) until the gap
 *      is closed or the list is exhausted.
 *   5. Tag priority by share of remaining gap consumed:
 *        >= 40%  high
 *        >= 15%  medium
 *        else    low
 */

export interface CutsInput {
  monthlyIncome: number;
  monthlySavingsTarget: number;
  currentMonthlySavings: number;
  rows: {
    category: string;
    budget: number;
    actual: number;
    gap: number;
    isEssential: boolean;
  }[];
}

export interface CutSuggestion {
  category: string;
  currentMonthly: number;
  suggestedReduction: number;
  reason: string;
  priority: "high" | "medium" | "low";
  isEssential: boolean;
  exampleActions: string[];
}

export interface CutsResult {
  summary: string;
  savingsGap: number;
  suggestions: CutSuggestion[];
  source: "local" | "ai";
}

const ESSENTIAL_CATS = new Set([
  "Insurance","Housing","Utilities","Medical","Family","Investment","Health",
]);

const EXAMPLE_PLAYBOOK: Record<string, string[]> = {
  Travel:        ["Defer one trip per year", "Switch to off-peak airfare windows", "Cut hotel star tier by one"],
  Shopping:      ["1-week wishlist cooldown before any purchase", "Cap discretionary buys at THB 2,000/wk", "Unsubscribe from sale emails"],
  Entertainment: ["Audit streaming subs, drop the bottom two", "Cap dine-out entertainment to 2x/wk", "Use library / free events for weekends"],
  Food:          ["Home-cook 4 dinners/wk", "Pack lunch 3x/wk", "Replace delivery with grocery + meal-prep"],
  Transport:     ["Limit Grab to 3 rides/wk, BTS the rest", "Bundle errands into one trip", "Walk for trips < 1 km"],
  Pet:           ["Switch to bulk-buy food", "Schedule vet visits annually not quarterly", "DIY grooming between pro visits"],
  Family:        ["Set a fixed monthly support figure and stick to it", "Pool family gifts into one shared cost"],
  Utilities:     ["AC at 25C, fan-first", "Switch to LED, audit standby loads", "Renegotiate fiber/mobile plan"],
  Insurance:     ["Annual coverage review — drop overlapping riders", "Increase deductible if emergency fund covers it"],
  Housing:       ["Refinance check at next anniversary", "Renegotiate condo fee on renewal"],
  Medical:       ["Use OPD coverage before paying out-of-pocket", "Generic substitutes where safe"],
  Investment:    ["Pause discretionary top-ups; keep only the auto-DCA"],
  Other:         ["Audit all line items for unused subscriptions"],
};

function exampleActionsFor(category: string): string[] {
  return EXAMPLE_PLAYBOOK[category] ?? EXAMPLE_PLAYBOOK.Other;
}

export function localSuggestCuts(input: CutsInput): CutsResult {
  const { monthlyIncome, monthlySavingsTarget, currentMonthlySavings, rows } = input;
  const gap = Math.max(0, monthlySavingsTarget - currentMonthlySavings);

  if (gap === 0) {
    return {
      summary: `You're already meeting your THB ${monthlySavingsTarget.toLocaleString()}/mo savings target. No cuts needed — keep the discipline going.`,
      savingsGap: 0,
      suggestions: [],
      source: "local",
    };
  }

  // Rank: discretionary first (1000pts), over-budget bonus (500pts), then by actual size.
  const ranked = [...rows].sort((a, b) => {
    const aIsEss = a.isEssential || ESSENTIAL_CATS.has(a.category);
    const bIsEss = b.isEssential || ESSENTIAL_CATS.has(b.category);
    const aScore = (aIsEss ? 0 : 1000) + (a.gap > 0 ? 500 : 0) + a.actual;
    const bScore = (bIsEss ? 0 : 1000) + (b.gap > 0 ? 500 : 0) + b.actual;
    return bScore - aScore;
  });

  let need = gap;
  const out: CutSuggestion[] = [];

  for (const r of ranked) {
    if (need <= 0) break;
    const isEss = r.isEssential || ESSENTIAL_CATS.has(r.category);
    const maxCut = isEss
      ? Math.max(0, r.actual - r.budget)
      : Math.round(r.actual * 0.5);
    if (maxCut <= 0) continue;

    const cut = Math.min(maxCut, need);
    const sharePct = (cut / gap) * 100;
    const priority: CutSuggestion["priority"] =
      sharePct >= 40 ? "high" : sharePct >= 15 ? "medium" : "low";

    const reason = isEss
      ? `Essential category running THB ${Math.round(r.actual - r.budget).toLocaleString()} over budget. Trim only the overage to bring it back to plan without cutting service.`
      : `Discretionary line at THB ${Math.round(r.actual).toLocaleString()}/mo — high-leverage cut with no impact on essentials. Targeting ~${Math.round((cut / r.actual) * 100)}% reduction.`;

    out.push({
      category: r.category,
      currentMonthly: Math.round(r.actual),
      suggestedReduction: Math.round(cut),
      reason,
      priority,
      isEssential: isEss,
      exampleActions: exampleActionsFor(r.category),
    });
    need -= cut;
  }

  const closed = gap - need;
  const pctClosed = Math.round((closed / gap) * 100);
  const summary = need <= 0
    ? `Local scan found THB ${Math.round(closed).toLocaleString()}/mo of cuts that close 100% of the gap to your THB ${monthlySavingsTarget.toLocaleString()}/mo target. Discretionary categories prioritized; essentials trimmed only where over budget.`
    : `Local scan found THB ${Math.round(closed).toLocaleString()}/mo of cuts (${pctClosed}% of the gap). The remaining THB ${Math.round(need).toLocaleString()}/mo gap requires either income growth or accepting some essential reductions.`;

  return { summary, savingsGap: gap, suggestions: out, source: "local" };
}
