/**
 * POST /api/statements/import
 *
 * Body: { mediaType: "application/pdf", data: <base64 of file> }
 *
 * Returns:
 * {
 *   statement: {
 *     bank, statementDate, billingMonth, periodStart, periodEnd,
 *     cardholderName, totalCharges, totalCredits
 *   },
 *   transactions: Transaction[]   // category=AI guess; isCredit/dedupeKey set
 * }
 *
 * The store dedupes by Transaction.dedupeKey before adding, so re-importing
 * the same statement is idempotent. The /expenses/actuals page then runs
 * deterministic merchant rules on top — rule match overrides Claude's guess.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import {
  BUDGET_CATEGORIES,
  buildDedupeKey,
  billingMonthFrom,
  toMerchantKey,
} from "@/lib/categorize";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const SYSTEM = `You extract structured credit-card statement data from PDFs.
Return STRICT JSON. Never add prose. Never add code fences.
All amounts are in the statement's billing currency (THB for Thai banks unless
the row contains an explicit FX line like "USD 21.40" or "EUR 29.04" — in that
case capture both).
Credits/refunds/payments are marked with "CR" suffix in UOB statements.
Use ISO yyyy-MM-dd dates. The statement covers ~one billing month; infer the
year from the statement date when the row only shows day+month.`;

const SCHEMA_HINT = `Return EXACTLY this shape:
{
  "bank": "UOB" | "KBANK" | "SCB" | "KTC" | "TMB" | "OTHER",
  "statementDate": "YYYY-MM-DD",
  "periodStart":   "YYYY-MM-DD",
  "periodEnd":     "YYYY-MM-DD",
  "cardholderName": string | null,
  "transactions": [
    {
      "postDate":   "YYYY-MM-DD",
      "transDate":  "YYYY-MM-DD",
      "description": string,
      "amount":     number,             // always POSITIVE; isCredit flag carries sign
      "isCredit":   boolean,            // true for refunds/payments (CR suffix)
      "currency":   "THB",
      "fxAmount":   number | null,      // original-currency amount if foreign
      "fxCurrency": "USD" | "EUR" | "GBP" | "JPY" | "SGD" | null,
      "cardLast4":  string | null,      // last 4 of the card the row belongs to
      "category":   one of [${BUDGET_CATEGORIES.map(c => `"${c}"`).join(", ")}],
      "confidence": number              // 0..1, how sure you are about the category
    }
  ]
}
Rules:
- Skip "PREVIOUS BALANCE", "SUB TOTAL", "TOTAL BALANCE", "TOTAL FEE", "TOTAL VAT" lines.
- Each card section starts with a row like "5271 73XX XXXX 4490 ... NAME" — assign that cardLast4 to every txn until the next card header.
- Default category guesses for common Thai merchants:
    Grab/MRT/BTS/Shell/PTT → Transport
    Tops/Lotus/Big C/Makro/7-11/Tesco → Food (groceries)
    LineMan/GrabFood/FoodPanda/Sushiro/Hot Pot/Sushi → Food (delivery)
    Shopee/Lazada/eBay/Amazon → Shopping
    Apple.com/Anthropic/Claude.ai/Spotify/Netflix → Entertainment
    AIA/Allianz/MTL → Insurance
    Siriraj/Bumrungrad/Watsons → Medical
    AIS/DTAC/True/TrueBill → Utilities
    Q Chang/HomePro → Housing
    Coway/Evolution Wellness/Fitness → Health
- If unsure, set category to "Other" with low confidence.`;

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { mediaType, data, fileName } = await req.json() as {
      mediaType: string;
      data: string;
      fileName?: string;
    };

    if (!data) return NextResponse.json({ error: "no_data" }, { status: 400 });
    if (mediaType !== "application/pdf") {
      return NextResponse.json(
        { error: "unsupported_media", message: "Only PDF statements are supported." },
        { status: 400 },
      );
    }

    const fileBuf = Buffer.from(data, "base64");
    const fileHash = sha256(fileBuf);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data },
          },
          { type: "text", text: `Extract the statement. ${SCHEMA_HINT} Output JSON only.` },
        ],
      }],
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

    if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
      return NextResponse.json({ error: "no_transactions", raw: parsed }, { status: 502 });
    }

    // ── Build hydrated Transaction[] with dedupeKey + merchantKey ────────
    const billingMonth = parsed.statementDate
      ? billingMonthFrom(parsed.statementDate)
      : billingMonthFrom(new Date().toISOString());

    const bank = (String(parsed.bank ?? "OTHER").toLowerCase() as any);
    const sourceTag: any = ["uob", "kbank", "scb", "kept", "tmb"].includes(bank) ? bank : "other";

    const transactions = parsed.transactions
      .filter((t: any) => t && typeof t.amount === "number" && t.description)
      .map((t: any) => {
        const merchantKey = toMerchantKey(String(t.description));
        const txn = {
          id: uuid(),
          postDate: t.postDate || parsed.statementDate,
          transDate: t.transDate || t.postDate || parsed.statementDate,
          billingMonth,
          description: String(t.description),
          merchantKey,
          amount: Math.abs(Number(t.amount) || 0),
          currency: (t.currency ?? "THB") as any,
          fxAmount: t.fxAmount ?? undefined,
          fxCurrency: t.fxCurrency ?? undefined,
          category: BUDGET_CATEGORIES.includes(t.category) ? t.category : "Other",
          source: sourceTag,
          cardLast4: t.cardLast4 ?? undefined,
          confidence: typeof t.confidence === "number" ? t.confidence : 0.5,
          isCredit: !!t.isCredit,
          dedupeKey: "",
        };
        txn.dedupeKey = buildDedupeKey(txn);
        return txn;
      });

    const totalCharges = transactions
      .filter((t: any) => !t.isCredit)
      .reduce((s: number, t: any) => s + t.amount, 0);
    const totalCredits = transactions
      .filter((t: any) => t.isCredit)
      .reduce((s: number, t: any) => s + t.amount, 0);

    return NextResponse.json({
      statement: {
        fileName: fileName ?? "statement.pdf",
        fileHash,
        bank: parsed.bank ?? "OTHER",
        statementDate: parsed.statementDate,
        billingMonth,
        periodStart: parsed.periodStart ?? null,
        periodEnd: parsed.periodEnd ?? null,
        cardholderName: parsed.cardholderName ?? null,
        totalCharges: Math.round(totalCharges),
        totalCredits: Math.round(totalCredits),
      },
      transactions,
    });
  } catch (e: any) {
    console.error("statement import error:", e);
    return NextResponse.json(
      { error: e?.message ?? "import_failed" },
      { status: 500 },
    );
  }
}
