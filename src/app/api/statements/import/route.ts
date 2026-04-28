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
 *   transactions: Transaction[]   // category from deterministic rules
 * }
 *
 * Uses local PDF parsing (pdf-parse) + deterministic merchant rules.
 * No API calls needed — works offline with ~80% merchant coverage.
 */

import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import {
  BUDGET_CATEGORIES,
  buildDedupeKey,
  billingMonthFrom,
  toMerchantKey,
  DEFAULT_MERCHANT_RULES,
  matchRule,
  buildDefaultMerchantRules,
} from "@/lib/categorize";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * Parse Thai credit card statement PDF text.
 * Returns detected bank, statement date, and transaction rows.
 */
function parseThaiStatement(text: string) {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l);

  let bank = "OTHER";
  let statementDate: string | null = null;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let cardholderName: string | null = null;
  const transactions: any[] = [];
  let currentCardLast4: string | null = null;

  // Detect bank by looking for keywords
  const fullText = text.toUpperCase();
  if (fullText.includes("UNITED OVERSEAS")) bank = "UOB";
  else if (fullText.includes("KASIKORNBANK")) bank = "KBANK";
  else if (fullText.includes("SIAM COMMERCIAL")) bank = "SCB";
  else if (fullText.includes("KRUNGTHAI")) bank = "KTC";
  else if (fullText.includes("THAI MILITARYBANK")) bank = "TMB";

  // Extract statement date (look for pattern like "22 April 2026")
  const dateMatch = text.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
    statementDate = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  } else {
    // Fallback to today
    const today = new Date();
    statementDate = today.toISOString().split("T")[0];
  }

  // Extract period (usually shows "From XX to YY" or similar)
  const periodMatch = text.match(/(?:from|From)\s+(\d{1,2})\s+\w+/i);
  if (periodMatch) {
    const [month, day] = statementDate.split("-").slice(1);
    const startDay = periodMatch[1].padStart(2, "0");
    periodStart = `${statementDate.split("-")[0]}-${month}-${startDay}`;
    periodEnd = statementDate;
  }

  // Try to extract cardholder name (often near the top)
  const namePatterns = [
    /MR\.\s+([A-Z\s]+)/,
    /MS\.\s+([A-Z\s]+)/,
    /Mrs\.\s+([A-Z\s]+)/,
  ];
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      cardholderName = match[1].trim();
      break;
    }
  }

  // Parse transaction rows
  // Pattern: look for lines with amounts (numbers with decimal points and commas)
  // Thai statements typically have: Date | Description | Amount | Balance
  const transactionPattern = /(\d{1,2}\/\d{1,2})\s+(.+?)\s+([\d,]+\.\d{2})\s*(?:CR)?/;
  const creditPattern = /CR|Credit|Refund/i;

  for (const line of lines) {
    // Skip header and summary lines
    if (
      line.match(/^(PREVIOUS|BALANCE|TOTAL|SUB|VAT|FEE|STATEMENT|PERIOD)/i) ||
      line.length < 10 ||
      !line.match(/\d/)
    ) {
      continue;
    }

    // Check for card header (e.g., "5271 73XX XXXX 4490")
    const cardMatch = line.match(/\d{4}\s+\d{2}XX\s+XXXX\s+(\d{4})/);
    if (cardMatch) {
      currentCardLast4 = cardMatch[1];
      continue;
    }

    // Try to extract transaction
    const amountMatch = line.match(/([\d,]+\.\d{2})/);
    if (amountMatch && line.match(/\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}/)) {
      const isCredit = creditPattern.test(line);
      const amount = parseFloat(amountMatch[1].replace(/,/g, ""));

      if (amount > 0) {
        // Extract date (try DD/MM or YYYY-MM-DD)
        let txnDate = statementDate;
        const dateMatch = line.match(/(\d{1,2})\/(\d{1,2})/);
        if (dateMatch) {
          const [, day, month] = dateMatch;
          const year = statementDate.split("-")[0];
          txnDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }

        // Extract description (everything before the amount)
        const descMatch = line.match(/^(.+?)\s+[\d,]+\.\d{2}/);
        const description = descMatch ? descMatch[1].trim() : line.substring(0, 50);

        transactions.push({
          transDate: txnDate,
          postDate: txnDate,
          description: description.slice(0, 100),
          amount,
          isCredit,
          currency: "THB",
          cardLast4: currentCardLast4,
          confidence: 0.6,
        });
      }
    }
  }

  return {
    bank,
    statementDate,
    periodStart,
    periodEnd,
    cardholderName,
    transactions,
  };
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

    // Extract text from PDF
    let pdfData: any;
    try {
      pdfData = await pdfParse(fileBuf);
    } catch (e: any) {
      return NextResponse.json(
        { error: "pdf_parse_failed", message: "Could not read PDF file." },
        { status: 400 },
      );
    }

    const text = pdfData.text || "";
    if (!text.trim()) {
      return NextResponse.json(
        { error: "no_text", message: "PDF contains no readable text." },
        { status: 400 },
      );
    }

    // Parse statement
    const parsed = parseThaiStatement(text);

    if (!parsed.transactions || parsed.transactions.length === 0) {
      return NextResponse.json(
        { error: "no_transactions", message: "No transactions found in statement." },
        { status: 400 },
      );
    }

    // Build merchant rules with defaults
    const defaultRules = buildDefaultMerchantRules();

    // ── Build hydrated Transaction[] with dedupeKey + categorization ────────
    const billingMonth = parsed.statementDate
      ? billingMonthFrom(parsed.statementDate)
      : billingMonthFrom(new Date().toISOString());

    const sourceTag = parsed.bank.toLowerCase();

    const transactions = parsed.transactions
      .filter((t: any) => t && typeof t.amount === "number" && t.description)
      .map((t: any) => {
        const merchantKey = toMerchantKey(String(t.description));

        // Apply deterministic rule matching
        const rule = matchRule(merchantKey, defaultRules);
        const category = rule ? rule.category : "Other";

        const txn = {
          id: uuid(),
          postDate: t.postDate || parsed.statementDate,
          transDate: t.transDate || t.postDate || parsed.statementDate,
          billingMonth,
          description: String(t.description).slice(0, 100),
          merchantKey,
          amount: Math.abs(Number(t.amount) || 0),
          currency: (t.currency ?? "THB") as any,
          fxAmount: t.fxAmount ?? undefined,
          fxCurrency: t.fxCurrency ?? undefined,
          category,
          source: sourceTag,
          cardLast4: t.cardLast4 ?? undefined,
          confidence: rule ? 1.0 : 0.6,  // 1.0 if rule matched, else 0.6 for heuristic
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
        bank: parsed.bank,
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
