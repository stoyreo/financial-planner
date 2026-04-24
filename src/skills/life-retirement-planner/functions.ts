/**
 * Life & Retirement Planner - Core Functions
 * Provides retirement analysis and life planning strategies
 */

import type { Profile, InvestmentAccount, ExpenseItem } from "@/lib/types";

export interface RetirementReadiness {
  yearsToRetirement: number;
  currentAge: number;
  retirementAge: number;
  currentAssets: number;
  projectedRetirementAssets: number;
  retirementIncomeNeeded: number;
  projectedMonthlyIncome: number;
  adequacyRatio: number;
  isAdequate: boolean;
  gaps: string[];
  recommendations: string[];
}

export interface LifeMilestone {
  phase: string;
  ageRange: string;
  priority: string;
  targetBalance: number;
  annualSavings: number;
  description: string;
}

export interface RetirementIncomeProjection {
  safeWithdrawalAmount: number;
  pensionIncome: number;
  investmentIncome: number;
  totalMonthlyIncome: number;
  projectedMonthlyExpenses: number;
  surplusDeficit: number;
  yearsOfRunway: number;
  isSustainable: boolean;
  recommendations: string[];
}

/**
 * Analyze retirement readiness based on current profile and assets
 */
export function analyzeRetirementReadiness(
  profile: Profile,
  assets: InvestmentAccount[],
  incomes: any[],
  expenses: ExpenseItem[]
): RetirementReadiness {
  const now = new Date();
  const currentAge = now.getFullYear() - parseInt(profile.dateOfBirth.split("-")[0]);
  const yearsToRetirement = Math.max(0, profile.retirementAge - currentAge);

  // Calculate current total assets
  const currentAssets = assets
    .filter(a => a.isActive)
    .reduce((sum, a) => sum + a.marketValue, 0);

  // Project assets at retirement (assume 6% annual return)
  const annualReturn = 0.06;
  const projectedRetirementAssets = currentAssets * Math.pow(1 + annualReturn, yearsToRetirement);

  // Calculate retirement expenses (assume 80% of current)
  const currentExpenses = expenses
    .filter(e => e.isActive)
    .reduce((sum, e) => {
      const freq = e.frequency === "monthly" ? 12 : e.frequency === "yearly" ? 1 : 1;
      return sum + (e.amount * freq);
    }, 0);

  const retirementExpenses = currentExpenses * 0.8; // Typically lower in retirement
  const monthlyRetirementExpenses = retirementExpenses / 12;

  // Safe withdrawal rate (4% rule)
  const safeWithdrawal = projectedRetirementAssets * 0.04 / 12; // Monthly

  // Add pension income
  const monthlyPension = profile.householdNotes?.includes("pension") ? 50000 : 0; // Placeholder

  const projectedMonthlyIncome = safeWithdrawal + monthlyPension;
  const adequacyRatio = projectedMonthlyIncome / monthlyRetirementExpenses;
  const isAdequate = adequacyRatio >= 1.0;

  const gaps: string[] = [];
  const recommendations: string[] = [];

  if (!isAdequate) {
    const shortfall = (monthlyRetirementExpenses - projectedMonthlyIncome) * 12;
    gaps.push(`Annual shortfall: ${shortfall.toLocaleString()}`);
    recommendations.push("Increase savings rate by 10-15%");
    recommendations.push(`Work 2-3 additional years to bridge gap`);
  }

  if (yearsToRetirement < 10 && currentAssets < retirementExpenses * 10) {
    gaps.push("Limited time horizon with low asset base");
    recommendations.push("Consider delaying retirement");
    recommendations.push("Significantly increase contributions");
  }

  return {
    yearsToRetirement,
    currentAge,
    retirementAge: profile.retirementAge,
    currentAssets,
    projectedRetirementAssets,
    retirementIncomeNeeded: monthlyRetirementExpenses,
    projectedMonthlyIncome,
    adequacyRatio,
    isAdequate,
    gaps,
    recommendations,
  };
}

/**
 * Suggest life milestone targets by age range
 */
export function suggestLifeMilestones(currentAge: number, annualIncome: number): LifeMilestone[] {
  const milestones: LifeMilestone[] = [
    {
      phase: "Foundation (25-35)",
      ageRange: "Ages 25-35",
      priority: "Build emergency fund & start investing",
      targetBalance: annualIncome * 1, // 1x annual income
      annualSavings: annualIncome * 0.15,
      description: "Establish 6-month emergency fund, max out retirement accounts",
    },
    {
      phase: "Acceleration (35-50)",
      ageRange: "Ages 35-50",
      priority: "Build wealth through aggressive investing",
      targetBalance: annualIncome * 6, // 6x annual income
      annualSavings: annualIncome * 0.20,
      description: "Increase contributions, diversify investments, manage major expenses",
    },
    {
      phase: "Peak (50-65)",
      ageRange: "Ages 50-65",
      priority: "Maximize retirement savings & de-risk",
      targetBalance: annualIncome * 12, // 12x annual income
      annualSavings: annualIncome * 0.25,
      description: "Catch-up contributions, rebalance to less volatile assets",
    },
    {
      phase: "Distribution (65+)",
      ageRange: "Age 65+",
      priority: "Sustainable withdrawal strategy",
      targetBalance: annualIncome * 25, // 25x for 4% rule
      annualSavings: 0,
      description: "4% annual withdrawal rule, minimize sequence-of-returns risk",
    },
  ];

  return milestones.filter(m => {
    const minAge = parseInt(m.ageRange.split("-")[0].replace("Ages ", ""));
    const maxAge = parseInt(m.ageRange.split("-")[1].replace("Age ", "").replace("+", ""));
    return currentAge >= minAge && (currentAge <= maxAge || m.ageRange.includes("+"));
  });
}

/**
 * Project retirement income sustainability
 */
export function projectRetirementIncome(
  totalAssets: number,
  monthlyExpenses: number,
  expectedAnnualReturn: number = 0.05
): RetirementIncomeProjection {
  // 4% safe withdrawal rule
  const annualWithdrawal = totalAssets * 0.04;
  const safeWithdrawalAmount = annualWithdrawal / 12;

  // Assume 60% from investments, 40% from other sources (pension, SS)
  const investmentIncome = safeWithdrawalAmount * 0.6;
  const pensionIncome = safeWithdrawalAmount * 0.4;

  const totalMonthlyIncome = safeWithdrawalAmount;
  const surplusDeficit = totalMonthlyIncome - monthlyExpenses;
  const isSustainable = surplusDeficit >= 0;

  // Years of runway (how long before money runs out at 0% return)
  const yearsOfRunway = isSustainable ? 100 : totalAssets / (monthlyExpenses * 12);

  const recommendations: string[] = [];
  if (!isSustainable) {
    recommendations.push("Reduce retirement expenses by 10-20%");
    recommendations.push("Work 3-5 additional years");
    recommendations.push("Adjust withdrawal strategy to lower than 4%");
  } else if (surplusDeficit < monthlyExpenses * 0.1) {
    recommendations.push("Consider modest spending reduction as buffer");
    recommendations.push("Monitor investment returns closely");
  } else {
    recommendations.push("Strong financial position for retirement");
    recommendations.push("Consider legacy planning or charitable giving");
  }

  return {
    safeWithdrawalAmount,
    pensionIncome,
    investmentIncome,
    totalMonthlyIncome,
    projectedMonthlyExpenses: monthlyExpenses,
    surplusDeficit,
    yearsOfRunway,
    isSustainable,
    recommendations,
  };
}
