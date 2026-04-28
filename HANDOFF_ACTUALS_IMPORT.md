# Handoff — Statement Import + Actuals + Savings Optimizer

**Branch:** `main` (working copy on disk)
**Date:** 2026-04-28
**Author:** Claude Sonnet → Claude Haiku
**Goal:** Ship the credit-card statement import → actuals reconciliation → AI cuts + savings optimizer feature.

---

## TL;DR for Haiku

Everything is already coded and on disk. Your job is:

1. `git status` — confirm 13 files changed (5 new, 5 modified).
2. Set `ANTHROPIC_API_KEY` in Vercel → Settings → Environment Variables (if not already set — `/api/payslip/extract` already uses it, so it usually is).
3. `git add -A && git commit -m "feat: statement import + actuals + savings optimizer"` (use the Windows-safe procedure from memory: rebuild `.git/index` first if it errors).
4. `git push origin main` → Vercel auto-deploys.
5. Verify on `financial101.vercel.app/expenses/actuals` → drop the sample PDF → check the budget vs actual table populates and the optimizer sliders work.

---

## What got built

### User flow

1. User clicks **Import Statement / Actuals** on `/expenses` → lands on `/expenses/actuals`.
2. Drops a UOB/KBank/SCB credit card statement PDF.
3. `/api/statements/import` sends the PDF to Claude Haiku 4.5 as a `document` block. Claude returns structured JSON: bank, statement date, billing month, period, every transaction with date/amount/merchant/cardLast4/FX/CR-flag and a first-pass category guess.
4. Client hydrates each transaction with a `dedupeKey` and ships them into the store via `importStatement(...)`.
5. `importStatement` (a) drops any txn whose `dedupeKey` already exists, (b) overrides Claude's category with deterministic merchant rules whenever a rule pattern matches, (c) records a `StatementImport` row with `transactionCount` (added) and `duplicatesSkipped`.
6. The page now shows: KPI strip, **Monthly Spend Evolution** trend chart (12 months), **Savings Optimizer Simulator** (sliders + chart), **Budget vs Actual** table with status badges, transactions table with **inline category dropdown** (re-mapping auto-creates a `MerchantRule`), statement history list, **Live AI Cuts** modal.

### Key design decisions

| Decision | Why |
|---|---|
| Use Claude `document` block, not `pdf-parse` | Existing `/api/payslip/extract` uses the same pattern — works for both text and scanned PDFs without an OCR pipeline. |
| Two-pass categorization (rules → AI) | Deterministic rules cover ~80% of common Thai merchants instantly and free; Claude only makes the calls that aren't matched. Rule match always wins so user re-mappings stick. |
| `dedupeKey = billingMonth\|postDate\|transDate\|cardLast4\|sign\|amount\|merchantKey` | Lets re-imports of the same statement be a no-op. Survives whitespace/case differences. |
| Keep `StatementImport` records forever | User explicitly asked for historical retention for trend analysis. `clearMonthTransactions(billingMonth)` only nukes txns; the `StatementImport` row stays as audit trail. |
| Inline category Select in the txn row, with `learnRule=true` | One click = both the txn changes AND a `MerchantRule` is saved → next import auto-applies. |
| Optimizer "Apply to Budget" prorates the new category total across active `ExpenseItem`s by their current weight | Preserves the user's budget structure (e.g., "Groceries" + "Dining" both under Food keep their relative split). |

---

## File manifest

### New files (5)

```
src/lib/categorize.ts                              ~200 lines  Merchant rules + dedupeKey helpers
src/lib/actuals.ts                                 ~180 lines  Aggregation: budget vs actual, trend, heuristic cuts
src/app/api/statements/import/route.ts             ~150 lines  PDF → Claude → typed Transaction[]
src/app/api/expenses/suggest-cuts/route.ts         ~110 lines  Claude live cut recommendations
src/app/expenses/actuals/page.tsx                  ~430 lines  Main UI (import, table, trend, AI panel, statement history)
src/components/dashboard/SavingsOptimizer.tsx      ~210 lines  Per-category sliders + projected savings chart
```

### Modified files (5)

```
src/lib/types.ts                Added Transaction, MerchantRule, StatementImport interfaces
src/lib/store.ts                Added transactions/merchantRules/statementImports state +
                                importStatement, recategorizeTransaction, deleteTransaction,
                                clearMonthTransactions, addMerchantRule, removeMerchantRule,
                                reapplyRules. Wired persistence through partialize +
                                loadUserNamespace + save* + exportData + importData.
src/lib/users.ts                Extended getEmptySnapshot() with empty transactions/rules/imports
src/app/expenses/page.tsx       Added "Import Statement / Actuals" button → /expenses/actuals
                                (no other changes — the standalone budget UI is untouched)
HANDOFF_ACTUALS_IMPORT.md       This file.
```

---

## Architecture diagram

```
                 ┌──────────────────────┐
  PDF upload  →  │ /api/statements/     │  →  base64 PDF + system prompt
                 │   import (Haiku 4.5) │  ←  structured JSON
                 └──────────┬───────────┘
                            │ Transaction[] (with dedupeKey)
                            ▼
                 ┌──────────────────────┐
                 │ store.importStatement│  ── dedupes by dedupeKey
                 │                      │  ── overrides category via MerchantRule match
                 │                      │  ── pushes StatementImport audit row
                 └──────────┬───────────┘
                            │ persisted to localStorage + Supabase
                            ▼
   /expenses/actuals page reads:
     ─ transactions[]               ──► Transactions table (inline re-map)
     ─ budgetVsActual(...)          ──► Budget vs Actual table
     ─ monthlyTrend(...)            ──► 12-month trend chart
     ─ rows + monthlyIncome         ──► <SavingsOptimizer> sliders
     ─ POST /api/expenses/          ──► Live AI Cuts modal
       suggest-cuts (Haiku 4.5)
```

---

## API contracts

### `POST /api/statements/import`

**Request**
```json
{
  "mediaType": "application/pdf",
  "data": "<base64>",
  "fileName": "eStatement.pdf"
}
```

**Response**
```json
{
  "statement": {
    "fileName": "eStatement.pdf",
    "fileHash": "sha256...",
    "bank": "UOB",
    "statementDate": "2026-04-22",
    "billingMonth": "2026-04",
    "periodStart": "2026-03-23",
    "periodEnd": "2026-04-22",
    "cardholderName": "MR. THEERANAN NAKSORN",
    "totalCharges": 78521,
    "totalCredits": 240195
  },
  "transactions": [
    {
      "id": "uuid",
      "postDate": "2026-04-02",
      "transDate": "2026-04-01",
      "billingMonth": "2026-04",
      "description": "WWW.GRAB.COM BANGKOK",
      "merchantKey": "WWW.GRAB.COM BANGKOK",
      "amount": 50,
      "currency": "THB",
      "category": "Transport",
      "source": "uob",
      "cardLast4": "4490",
      "confidence": 0.95,
      "isCredit": false,
      "dedupeKey": "2026-04|2026-04-02|2026-04-01|4490|D|5000|WWW.GRAB.COM BANGKOK"
    }
    // ... ~80 more for a typical UOB statement
  ]
}
```

### `POST /api/expenses/suggest-cuts`

**Request**
```json
{
  "monthlyIncome": 130000,
  "monthlySavingsTarget": 30000,
  "currentMonthlySavings": 12000,
  "billingMonth": "2026-04",
  "rows": [{ "category": "Food", "budget": 12000, "actual": 18500, "gap": 6500, "isEssential": true }],
  "topMerchants": [{ "merchant": "WWW.GRAB.COM", "amount": 5200 }],
  "recentMonths": [{ "ym": "2026-03", "total": 95000 }, { "ym": "2026-04", "total": 118000 }]
}
```

**Response**
```json
{
  "summary": "Spending jumped 24% vs last month, mainly Travel and Shopping.",
  "savingsGap": 18000,
  "suggestions": [
    {
      "category": "Travel",
      "currentMonthly": 24000,
      "suggestedReduction": 12000,
      "reason": "Domestic-only this quarter would close half the gap.",
      "priority": "high",
      "isEssential": false,
      "exampleActions": [
        "Postpone the May Chiang Mai trip by one month",
        "Use BTS instead of Grab for daily commute (saves ~2,500 THB)"
      ]
    }
  ]
}
```

---

## Default merchant rules included

`src/lib/categorize.ts → DEFAULT_MERCHANT_RULES` — ~60 patterns derived from the UOB sample statement, covering:

- **Transport:** Grab, GrabTaxi, MRT-BEM, BTS, Shell, PTT, Esso, Bangchak
- **Food:** Tops, Lotus, Big C, Makro, 7-11, FamilyMart, LineMan, Sushiro, Hot Pot Man, Hump Zaab, etc.
- **Shopping:** Shopee, Lazada, eBay, Amazon, The Mall, Vela, Central, Emporium, Uniqlo, MUJI
- **Utilities:** TMN TrueBill, AIS, DTAC, True Move, MEA, MWA
- **Entertainment / Subscriptions:** Apple.com/Bill, Netflix, Spotify, YouTube, Disney, Anthropic, Claude.ai, Major Cineplex
- **Health / Medical:** Evolution Wellness, Coway, Siriraj, Bumrungrad, Watsons, Boots
- **Insurance:** AIATH Auto Payment, AIA, Muang Thai Life, Allianz, Generali
- **Housing:** Q Chang (HCB00014), HomePro, IKEA

The longest pattern wins (so `WWW.2C2P.COM*Q CHANG` correctly maps to Housing, not generic `WWW.2C2P.COM` → Other).

---

## Test plan (manual smoke)

1. Build: `npm run build` → no errors from new code (the pre-existing `xlsx`/`BackupWidget` warnings are out of scope).
2. Dev: `npm run dev` → log in → navigate to `/expenses` → click **Import Statement / Actuals**.
3. Upload `Statement Example UOB/eStatement.pdf` → wait ~10s.
4. Verify:
   - KPI strip shows Apr 2026 totals.
   - Trend chart shows the single bar.
   - Budget vs Actual table shows Food/Transport/Shopping/Travel rows with the correct status badges.
   - Transactions table lists ~80 rows with categories filled in.
   - Change one row's category dropdown → check `localStorage` shows a new `MerchantRule` with `source: "user"`.
5. Re-upload the same PDF → status banner reads "Imported 0 new transactions ... 80 duplicates skipped" → confirms dedupe.
6. Open **Live AI Cuts** → enter target → verify Claude returns ranked suggestions with example actions.
7. Move a slider in the **Savings Optimizer** → verify projected savings + months-to-1M update live.
8. Click **Apply to Budget** → navigate to `/expenses` → confirm `budgetAmount` fields are updated.

---

## Edge cases the code already handles

- Re-importing the same statement (dedupeKey).
- Statement pages with multiple cards (cardLast4 captured per row).
- Foreign-currency rows (`fxAmount` + `fxCurrency` preserved).
- Refund/payment lines (`isCredit: true`, displayed in green, excluded from "spend" totals).
- Categories that exist in actuals but not in budget (shown with budget=0, status=over).
- Categories budgeted but with zero actual spend (shown with status=ok, gap=−budget).
- User changes merchant rules → call `reapplyRules()` (button in transactions header) to re-categorize all stored history.
- `loadSeedData` now preserves transactions/imports — clicking "Reset to Demo" doesn't wipe statement history.

---

## Things explicitly out of scope (next sprints)

- **Scanned PDFs:** Claude's `document` block handles them but quality varies. If statement is image-only, the user's screenshot upload path could route through `/api/payslip/extract` style image flow. Add tesseract.js fallback only if a real-world failure shows up.
- **Multi-bank parsers:** The route currently asks Claude to identify bank=UOB/KBank/SCB/KTC/TMB/OTHER. KBank and SCB layouts haven't been validated yet — collect samples and tweak `SCHEMA_HINT` if needed.
- **Recurring-spend detection:** Could mine `transactions[]` to flag merchants the user pays every month and auto-create matching `ExpenseItem` budget lines.
- **Per-account split:** All transactions currently roll into the same store; could be split by user account when the household feature lands.

---

## Windows commit safety reminder (from memory)

Before `git add` / `git commit`, in PowerShell from the project root:

```powershell
# If you ever see "fatal: index file corrupt":
Remove-Item .git\index -Force -ErrorAction SilentlyContinue
git read-tree HEAD
```

Then run the build BEFORE pushing:

```bash
npm run build
git add -A
git commit -m "feat(expenses): statement import + actuals + savings optimizer"
git push origin main   # Vercel auto-deploys; deploy email goes out via existing hook
```
