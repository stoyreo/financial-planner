# FinancePlan TH — Personal Financial Planning App

A production-quality web app for Thailand-based personal financial planning,
mortgage simulation, debt-vs-income analysis, and dynamic scenario planning.

---

## Quick Start (2 minutes)

```bash
# 1. Navigate into the project folder
cd "financial-planner"

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev

# 4. Open in browser
#    http://localhost:3000
```

No database or API keys needed. All data is stored in your browser's localStorage.

---

## Features

| Module | What it does |
|--------|-------------|
| **Dashboard** | KPI cards, cash flow charts, mortgage snapshot, net worth trend, milestones |
| **Profile** | DOB-driven age calculations, retirement target, emergency fund goal |
| **Income** | CRUD with growth rates, taxability toggle, multi-frequency support |
| **Expenses** | CRUD with inflation rates, essential vs discretionary, category pie |
| **Debts & Mortgage** | Full amortization engine, extra-payment simulator, strategy comparison |
| **Investments** | PVD / RMF / SSF / brokerage tracking, 20-yr growth projection |
| **Tax Planning** | Thailand PIT brackets, deduction optimiser, RMF vs debt paydown analysis |
| **Scenarios** | Create / compare up to 4 scenarios side-by-side (net worth, mortgage payoff) |
| **Forecast** | Year-by-year table to age 90, monthly 5-year detail, DTI/DSR ratio chart |

---

## Architecture

```
src/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Dashboard
│   ├── profile/page.tsx
│   ├── income/page.tsx
│   ├── expenses/page.tsx
│   ├── debts/page.tsx          # Mortgage simulator lives here
│   ├── investments/page.tsx
│   ├── tax/page.tsx
│   ├── scenarios/page.tsx
│   └── forecast/page.tsx
├── components/
│   ├── layout/AppShell.tsx     # Sidebar + theme toggle
│   └── ui/index.tsx            # All shared UI primitives
└── lib/
    ├── types.ts                # All TypeScript interfaces
    ├── utils.ts                # THB formatter, date helpers, math helpers
    ├── store.ts                # Zustand store with localStorage persistence
    ├── seed.ts                 # Realistic Thai demo data
    └── engine/
        ├── mortgage.ts         # Amortization engine + scenario comparison
        ├── forecast.ts         # Yearly + monthly forecast generator
        └── tax.ts              # Thailand PIT calculator + deduction optimiser
```

---

## Calculation Engine Summary

### Mortgage (engine/mortgage.ts)
```
Monthly interest  = balance × (annualRate / 12)
Principal paid    = payment − interest
Extra principal   = extraMonthly + (annualLumpSum if month % 12 === 0)
Closing balance   = opening − principal − extra
```
Supports refinance events (rate change + fee), annual prepayments,
rate change scenarios, and early payoff detection.

### Thailand Tax (engine/tax.ts)
Progressive PIT brackets: 0% / 5% / 10% / 15% / 20% / 25% / 30% / 35%
Key deductions computed: employment (50%, max 100K), PVD (max 15% salary),
RMF (max 30% income), SSF, life insurance, health insurance, mortgage interest.
Also computes: tax saved by RMF, additional RMF room, and debt-vs-tax comparison.

### Forecast (engine/forecast.ts)
- Builds amortization schedules for all debts upfront
- Iterates year-by-year from planning start → life expectancy
- Applies income growth, inflation, scenario overrides per year
- Tracks investment compound growth with contributions
- Detects milestones: mortgage paid off, debt free, retirement, emergency fund

---

## Scenario Planning

Five built-in scenarios:
- **Base Case** — 4% income growth, 3% inflation, 5K/month extra to mortgage
- **Aggressive Paydown** — 20K/month extra + 100K annual lump sum
- **Income Shock** — 50% income loss for 12 months
- **Refinance in 2 Years** — New rate at 5.5%
- **Retirement First** — No extra mortgage payments, max investment contributions

Compare any 2–4 scenarios side-by-side: net worth trajectory, mortgage payoff year,
net worth at 10yr / 20yr.

---

## Data Export / Import

Use the **Export** button in the sidebar to download `financial-plan.json`.
Use **Import** to reload a saved plan.
Use **Reset to Demo Data** to restore the seed data at any time.

---

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — utility-first styling + dark mode
- **Zustand** + immer — global state with localStorage persistence
- **Recharts** — all charts
- **date-fns** — date arithmetic
- **uuid** — ID generation

