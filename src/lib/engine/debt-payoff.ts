/**
 * DEBT PAYOFF ENGINE
 * ──────────────────
 * Calculates payoff date and metrics for any debt account.
 * Handles edge cases: zero payments, negative values, payoff year calculation.
 */

import type { DebtAccount, Profile } from "@/lib/types";

export interface PayoffMetrics {
  payoffYear: number;
  payoffDate: string;
  monthsRemaining: number;
  payoffMonth: number;
  payoffMonthName: string;
}

export interface PayoffInfo {
  label: string;
  age: number | null;
  date: Date | null;
  status: "done" | "stalled" | "on-track";
}

/**
 * Calculate payoff year, date, and months remaining for a debt.
 *
 * @param balance - Current balance in currency units
 * @param monthlyPayment - Monthly payment amount (0 = interest-only, never pays off)
 * @param currentYear - Current calendar year (e.g., 2026)
 * @returns PayoffMetrics with payoff year, date, and months remaining
 */
export function calculatePayoffYear(
  balance: number,
  monthlyPayment: number,
  currentYear: number
): PayoffMetrics {
  // Defensive: handle edge cases
  if (balance <= 0) {
    return {
      payoffYear: currentYear,
      payoffDate: `${currentYear}-01-01`,
      monthsRemaining: 0,
      payoffMonth: 1,
      payoffMonthName: "January",
    };
  }

  // If payment is zero or negative, debt never pays off
  if (monthlyPayment <= 0) {
    return {
      payoffYear: 9999,
      payoffDate: "Never",
      monthsRemaining: 999999,
      payoffMonth: 1,
      payoffMonthName: "Never",
    };
  }

  // Simple linear calculation: months = balance / monthly_payment
  // This is a conservative estimate (ignores interest accrual)
  // For more precision, would need interest rate
  const monthsRemaining = Math.ceil(balance / monthlyPayment);

  // Convert months to years and months
  const yearsFromNow = Math.floor(monthsRemaining / 12);
  const extraMonths = monthsRemaining % 12;

  const payoffYear = currentYear + yearsFromNow;
  const payoffMonth = extraMonths > 0 ? extraMonths : 1;

  // Month names for display
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const payoffMonthName = monthNames[payoffMonth - 1] || "January";

  // Format date (ISO format)
  const payoffDate = `${payoffYear}-${String(payoffMonth).padStart(2, "0")}-01`;

  return {
    payoffYear,
    payoffDate,
    monthsRemaining,
    payoffMonth,
    payoffMonthName,
  };
}

/**
 * Format payoff year for display in debt card
 * Example: "Fully paid: 2035"
 */
export function formatPayoffDisplay(payoffYear: number): string {
  if (payoffYear === 9999) {
    return "Fully paid: Never";
  }
  return `Fully paid: ${payoffYear}`;
}

/**
 * Calculate payoff metrics for multiple debts
 */
export function calculateMultiplePayoffs(
  debts: { id: string; name: string; currentBalance: number; standardMonthlyPayment: number; extraMonthlyPayment: number }[],
  currentYear: number
) {
  return debts.map(debt => {
    const totalPayment = debt.standardMonthlyPayment + debt.extraMonthlyPayment;
    const metrics = calculatePayoffYear(debt.currentBalance, totalPayment, currentYear);
    return {
      debtId: debt.id,
      debtName: debt.name,
      ...metrics,
      displayText: formatPayoffDisplay(metrics.payoffYear),
    };
  });
}

/**
 * Compute months to payoff using proper amortization math.
 * Handles: zero-interest debts, negative amortization, paid-off debts.
 *
 * Formula for fixed-rate amortization:
 *   n = -log(1 - (balance * monthlyRate) / payment) / log(1 + monthlyRate)
 *
 * @param debt - Debt account with balance, rate, and payment info
 * @returns Number of months until payoff (0 if paid, Infinity if stalled)
 */
export function computePayoffMonths(debt: DebtAccount): number {
  const balance = debt.currentBalance;
  const payment = debt.standardMonthlyPayment + debt.extraMonthlyPayment;
  const monthlyRate = (debt.annualInterestRate / 100) / 12;

  // Already paid off
  if (balance <= 0) {
    return 0;
  }

  // Zero interest: simple division
  if (monthlyRate === 0) {
    return Math.ceil(balance / payment);
  }

  // Negative amortization: payment <= monthly interest (balance grows)
  const monthlyInterest = balance * monthlyRate;
  if (payment <= monthlyInterest) {
    return Infinity;
  }

  // Standard amortization formula
  const n = -Math.log(1 - (balance * monthlyRate) / payment) / Math.log(1 + monthlyRate);
  return Math.ceil(n);
}

/**
 * Compute payoff info including label, age at payoff, and status.
 * Uses profile DOB if available, otherwise falls back to age field.
 *
 * @param debt - Debt account
 * @param profile - User profile with optional dateOfBirth or age
 * @returns PayoffInfo with label, age at payoff, date, and status
 */
export function computePayoffInfo(debt: DebtAccount, profile: Profile): PayoffInfo {
  const months = computePayoffMonths(debt);

  // Already paid off
  if (months === 0) {
    return {
      label: "Paid off",
      age: null,
      date: null,
      status: "done",
    };
  }

  // Negative amortization (stalled)
  if (!isFinite(months)) {
    return {
      label: "Never at current payment",
      age: null,
      date: null,
      status: "stalled",
    };
  }

  // Compute payoff date using average month length (30.4375 days)
  const now = new Date();
  const daysToPayoff = months * 30.4375;
  const payoffDate = new Date(now.getTime() + daysToPayoff * 24 * 60 * 60 * 1000);

  // Compute owner's current age
  let ownerAgeNow: number | null = null;
  if (profile.dateOfBirth) {
    const dob = new Date(profile.dateOfBirth);
    const ageMs = now.getTime() - dob.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    ownerAgeNow = Math.floor(ageDays / 365.25);
  }

  // Compute age at payoff
  const ageAtPayoff = ownerAgeNow !== null ? Math.floor(ownerAgeNow + months / 12) : null;

  // Format date label: "Mar 2042"
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  });
  const dateLabel = dateFormatter.format(payoffDate);

  // Build label
  let label: string;
  if (ageAtPayoff !== null) {
    label = `Paid off at age ${ageAtPayoff} · ${dateLabel}`;
  } else {
    label = `Paid off ${dateLabel}`;
  }

  return {
    label,
    age: ageAtPayoff,
    date: payoffDate,
    status: "on-track",
  };
}
