/**
 * THAILAND TAX ENGINE
 * ────────────────────
 * Computes estimated personal income tax under Thailand's progressive brackets.
 *
 * 2024 Thailand PIT brackets (taxable income in THB):
 *   0       –   150,000  →  0%
 *   150,001 –   300,000  →  5%
 *   300,001 –   500,000  →  10%
 *   500,001 –   750,000  →  15%
 *   750,001 – 1,000,000  →  20%
 *  1,000,001 – 2,000,000 →  25%
 *  2,000,001 – 5,000,000 →  30%
 *  5,000,001+             →  35%
 *
 * Key deductions:
 *   - Personal allowance: 60,000
 *   - Employment income deduction: 50% of income, max 100,000
 *   - PVD: full contribution (max 15% of salary, max 500,000)
 *   - RMF: up to 30% of taxable income, max 500,000 (combined SSF/RMF/PVD ≤ 500,000)
 *   - SSF: up to 30% of taxable income, max 200,000
 *   - Life insurance: max 100,000
 *   - Health insurance: max 25,000
 *   - Mortgage interest: max 100,000
 *   - Parental deduction: 30,000 per parent (max 2)
 *   - Child deduction: 30,000 per child (2nd+ 60,000)
 */

import type { TaxAssumptions } from "../types";

const BRACKETS = [
  { limit: 150_000, rate: 0 },
  { limit: 300_000, rate: 0.05 },
  { limit: 500_000, rate: 0.10 },
  { limit: 750_000, rate: 0.15 },
  { limit: 1_000_000, rate: 0.20 },
  { limit: 2_000_000, rate: 0.25 },
  { limit: 5_000_000, rate: 0.30 },
  { limit: Infinity, rate: 0.35 },
];

export function calcThaiTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let remaining = taxableIncome;
  let previousLimit = 0;

  for (const bracket of BRACKETS) {
    const bracketSize = bracket.limit - previousLimit;
    const taxableInBracket = Math.min(remaining, bracketSize);
    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
    previousLimit = bracket.limit;
    if (remaining <= 0) break;
  }
  return Math.max(0, tax);
}

export interface TaxResult {
  grossIncome: number;
  employmentDeduction: number;
  pvdDeduction: number;
  rmfDeduction: number;
  ssfDeduction: number;
  lifeInsuranceDeduction: number;
  healthInsuranceDeduction: number;
  mortgageInterestDeduction: number;
  parentalDeduction: number;
  childDeduction: number;
  otherDeductions: number;
  personalAllowance: number;
  totalDeductions: number;
  taxableIncome: number;
  estimatedTax: number;
  effectiveTaxRate: number;
  marginalRate: number;
  // Planning metrics
  taxSavedByRMF: number;
  taxSavedByPVD: number;
  additionalRMFRoom: number;   // more you can contribute to save tax
  additionalSSFRoom: number;
}

export function computeTax(t: TaxAssumptions): TaxResult {
  const grossIncome = t.annualGrossIncome + t.annualBonus;

  // --- Deductions ---
  // Employment income deduction: 50% of income, max 100,000
  const employmentDeduction = Math.min(grossIncome * 0.5, 100_000);

  // PVD: up to 15% of income, max 500,000
  const pvdDeduction = Math.min(t.pvdContribution, grossIncome * 0.15, 500_000);

  // Tax-advantaged investment limit (RMF + SSF + PVD combined ≤ 500,000)
  const investmentBudget = Math.max(0, 500_000 - pvdDeduction);

  // RMF: 30% of income, max 500,000, but combined with SSF/PVD ≤ 500,000
  const rmfDeduction = Math.min(t.rmfContribution, grossIncome * 0.30, investmentBudget);
  const remainingBudget = Math.max(0, investmentBudget - rmfDeduction);

  // SSF: 30% of income, max 200,000
  const ssfDeduction = Math.min(t.ssfContribution, grossIncome * 0.30, 200_000, remainingBudget);

  // Life insurance: max 100,000
  const lifeInsuranceDeduction = Math.min(t.lifeInsurancePremium, 100_000);

  // Health insurance: max 25,000
  const healthInsuranceDeduction = Math.min(t.healthInsurancePremium, 25_000);

  // Mortgage interest: max 100,000
  const mortgageInterestDeduction = Math.min(t.mortgageInterestDeduction, 100_000);

  // Parental: 30,000 per parent
  const parentalDeduction = t.parentalDeduction;

  // Child deduction
  const childDeduction = t.childDeduction;

  // Personal allowance
  const personalAllowance = t.personalDeduction || 60_000;

  const totalDeductions =
    employmentDeduction +
    pvdDeduction +
    rmfDeduction +
    ssfDeduction +
    lifeInsuranceDeduction +
    healthInsuranceDeduction +
    mortgageInterestDeduction +
    parentalDeduction +
    childDeduction +
    t.otherDeductions +
    personalAllowance;

  const taxableIncome = Math.max(0, grossIncome - totalDeductions);
  const estimatedTax = calcThaiTax(taxableIncome);
  const effectiveTaxRate = grossIncome > 0 ? estimatedTax / grossIncome : 0;

  // Marginal rate
  let marginalRate = 0;
  let cum = 0;
  let prevLim = 0;
  for (const b of BRACKETS) {
    cum += b.limit - prevLim;
    if (cum >= taxableIncome) { marginalRate = b.rate; break; }
    prevLim = b.limit;
  }

  // Tax saved by RMF: tax without RMF minus tax with RMF
  const taxWithoutRMF = calcThaiTax(Math.max(0, taxableIncome + rmfDeduction));
  const taxSavedByRMF = taxWithoutRMF - estimatedTax;

  // Tax saved by PVD
  const taxWithoutPVD = calcThaiTax(Math.max(0, taxableIncome + pvdDeduction));
  const taxSavedByPVD = taxWithoutPVD - estimatedTax;

  // Additional RMF room
  const maxRMF = Math.min(grossIncome * 0.30, investmentBudget);
  const additionalRMFRoom = Math.max(0, maxRMF - rmfDeduction);
  const maxSSF = Math.min(grossIncome * 0.30, 200_000, remainingBudget);
  const additionalSSFRoom = Math.max(0, maxSSF - ssfDeduction);

  return {
    grossIncome,
    employmentDeduction,
    pvdDeduction,
    rmfDeduction,
    ssfDeduction,
    lifeInsuranceDeduction,
    healthInsuranceDeduction,
    mortgageInterestDeduction,
    parentalDeduction,
    childDeduction,
    otherDeductions: t.otherDeductions,
    personalAllowance,
    totalDeductions,
    taxableIncome,
    estimatedTax,
    effectiveTaxRate,
    marginalRate,
    taxSavedByRMF,
    taxSavedByPVD,
    additionalRMFRoom,
    additionalSSFRoom,
  };
}

/** Compare "invest more for tax relief" vs "pay down debt" */
export function compareTaxVsDebt(params: {
  tax: TaxAssumptions;
  extraAmount: number;
  debtInterestRate: number;
}): {
  taxReliefBenefit: number;
  debtInterestSaving: number;
  recommendation: "tax-relief" | "debt-paydown" | "equal";
  reasoning: string;
} {
  const baseResult = computeTax(params.tax);
  const withExtraRMF = computeTax({
    ...params.tax,
    rmfContribution: params.tax.rmfContribution + params.extraAmount,
  });
  const taxReliefBenefit = baseResult.estimatedTax - withExtraRMF.estimatedTax;
  const debtInterestSaving = params.extraAmount * params.debtInterestRate;

  const recommendation =
    taxReliefBenefit > debtInterestSaving
      ? "tax-relief"
      : taxReliefBenefit < debtInterestSaving
      ? "debt-paydown"
      : "equal";

  return {
    taxReliefBenefit,
    debtInterestSaving,
    recommendation,
    reasoning:
      recommendation === "tax-relief"
        ? `Investing ฿${params.extraAmount.toLocaleString()} in RMF saves ฿${taxReliefBenefit.toFixed(0)} in tax vs ฿${debtInterestSaving.toFixed(0)} in debt interest. Invest for tax relief.`
        : recommendation === "debt-paydown"
        ? `Paying ฿${params.extraAmount.toLocaleString()} toward debt saves ฿${debtInterestSaving.toFixed(0)} in interest vs ฿${taxReliefBenefit.toFixed(0)} in tax. Pay down debt.`
        : "Both strategies yield equal benefit.",
  };
}
