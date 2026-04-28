/**
 * POST /api/expenses/suggest-cuts
 *
 * Body:
 * {
 *   monthlyIncome: number,
 *   monthlySavingsTarget: number,
 *   currentMonthlySavings: number,
 *   billingMonth: "YYYY-MM",
 *   rows: [{ category, budget, actual, gap, isEssential }],
 *   topMerchants: [{ merchant, amount }],   // optional helpful context
 *   recentMonths: [{ ym, total }]           // last 6 months for trend context
 * }
 *
 * Returns:
 * {
 *   summary: string,                  // 2-3 sentence narrative
 *   savingsGap: number,               // how far short of target the user is
 *   suggestions: [
 *     { category, currentMonthly, suggestedReduction, reason, priority,
 *       isEssential, exampleActions: string[] }
 *   ]
 * }
 *
 * Uses Haiku 4.5 for low-latency live recommendations.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYSTEM = `You are a Thai personal-finance coach. The user already has a
budget and a savings target. They've shared this month's actual spend per
category. Your job: rank concrete cuts that close the savings gap fastest
WHILE protecting essentials. Return STRICT JSON only — no prose, no fences.

Cut philosophy:
- Always favor discretionary categories first (Travel, Shopping, Entertainment, dining-out Food).
- Essentials (Insurance, Housing, Utilities, Medical, Family, Investment) are off-limits unless
  the actual is materially over budget — then suggest only the OVERAGE, never the whole line.
- Each suggestion should specify a concrete monthly THB number plus a 1-2 sentence reason.
- Stop suggesting once the cumulative savings reach the target.
- Add 2-3 example actions per suggestion (e.g., "limit Grab rides to 3/week", "cancel Apple TV+", "swap Sushiro dinners for home cooking 2x/wk").`;

const SCHEMA = `{
  "summary": string,
  "savingsGap": number,
  "suggestions": [{
    "category": string,
    "currentMonthly": number,
    "suggestedReduction": number,
    "reason": string,
    "priority": "high" | "medium" | "low",
    "isEssential": boolean,
    "exampleActions": [string]
  }]
}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      monthlyIncome = 0,
      monthlySavingsTarget = 0,
      currentMonthlySavings = 0,
      billingMonth,
      rows = [],
      topMerchants = [],
      recentMonths = [],
    } = body ?? {};

    const userPrompt = `Billing month: ${billingMonth}
Monthly net income: ฿${monthlyIncome.toLocaleString()}
Monthly savings target: ฿${monthlySavingsTarget.toLocaleString()}
Current monthly savings (income − total actual spend): ฿${currentMonthlySavings.toLocaleString()}
Savings gap: ฿${Math.max(0, monthlySavingsTarget - currentMonthlySavings).toLocaleString()}

Per-category budget vs actual (THB/month):
${rows.map((r: any) =>
  `- ${r.category}${r.isEssential ? " (ESSENTIAL)" : ""}: budget ${Math.round(r.budget).toLocaleString()}, actual ${Math.round(r.actual).toLocaleString()}, gap ${Math.round(r.gap).toLocaleString()}`
).join("\n")}

Top merchants this month:
${topMerchants.slice(0, 10).map((m: any) => `- ${m.merchant}: ฿${Math.round(m.amount).toLocaleString()}`).join("\n")}

Recent monthly totals (oldest → newest):
${recentMonths.map((m: any) => `- ${m.ym}: ฿${Math.round(m.total).toLocaleString()}`).join("\n")}

Return JSON exactly matching this schema:
${SCHEMA}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = msg.content
      .filter(b => b.type === "text")
      .map(b => (b as any).text)
      .join("");
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();

    let parsed: any;
    try { parsed = JSON.parse(jsonStr); }
    catch {
      return NextResponse.json({ error: "parse_failed", raw: text }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error("suggest-cuts error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
