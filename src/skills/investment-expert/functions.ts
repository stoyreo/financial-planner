/**
 * Investment Expert Advisor - Core Functions
 * Portfolio optimization, asset allocation, and risk analysis
 */

import type { RiskProfile, InvestmentAccount } from "@/lib/types";

export interface AssetAllocation {
  assetClass: string;
  targetPercentage: number;
  currentPercentage: number;
  dollarAmount: number;
  variance: number;
  recommendation: string;
}

export interface AssetAllocationStrategy {
  riskProfile: RiskProfile;
  timeHorizonYears: number;
  allocation: AssetAllocation[];
  summary: string;
  riskLevel: string;
  expectedReturn: number;
  expectedVolatility: number;
}

export interface PortfolioRiskAnalysis {
  concentrationRatio: number;
  largestHoldingPercent: number;
  diversificationScore: number; // 0-100
  volatilityEstimate: number;
  correlationRisk: string;
  currencyExposure: number;
  sectorConcentration: Record<string, number>;
  riskLevel: string;
  recommendations: string[];
}

export interface ReturnProjection {
  scenario: string;
  percentile: number;
  annualReturn: number;
  projectedValue: number;
  years: number;
  inflationAdjusted: number;
  monthlyContributionImpact: number;
}

/**
 * Optimize asset allocation based on risk profile and time horizon
 */
export function optimizeAssetAllocation(
  riskProfile: RiskProfile,
  currentAssets: InvestmentAccount[],
  timeHorizonYears: number = 20
): AssetAllocationStrategy {
  const totalValue = currentAssets.reduce((sum, a) => sum + a.marketValue, 0);

  // Base allocations by risk profile
  const baseAllocations: Record<RiskProfile, Record<string, number>> = {
    conservative: { stocks: 0.30, bonds: 0.60, cash: 0.10 },
    moderate: { stocks: 0.60, bonds: 0.35, cash: 0.05 },
    aggressive: { stocks: 0.80, bonds: 0.15, cash: 0.05 },
  };

  // Adjust for time horizon (more conservative as approaching retirement)
  const timeAdjustment = Math.min(timeHorizonYears / 30, 1.0);
  let allocation = { ...baseAllocations[riskProfile] };

  if (timeHorizonYears < 10) {
    // Shift 10% toward bonds for shorter horizons
    allocation.stocks = Math.max(allocation.stocks - 0.10, 0.20);
    allocation.bonds = Math.min(allocation.bonds + 0.10, 0.70);
  }

  // Expected returns and volatility by asset class
  const expectedReturns = { stocks: 0.08, bonds: 0.04, cash: 0.02 };
  const volatilities = { stocks: 0.16, bonds: 0.05, cash: 0.01 };

  const totalExpectedReturn =
    allocation.stocks * expectedReturns.stocks +
    allocation.bonds * expectedReturns.bonds +
    allocation.cash * expectedReturns.cash;

  const totalVolatility = Math.sqrt(
    Math.pow(allocation.stocks * volatilities.stocks, 2) +
      Math.pow(allocation.bonds * volatilities.bonds, 2) +
      Math.pow(allocation.cash * volatilities.cash, 2)
  );

  const allocations: AssetAllocation[] = [
    {
      assetClass: "Stocks (Equities)",
      targetPercentage: allocation.stocks,
      currentPercentage: currentAssets
        .filter(a => a.accountType === "brokerage")
        .reduce((sum, a) => sum + a.marketValue, 0) / totalValue,
      dollarAmount: allocation.stocks * totalValue,
      variance: 0,
      recommendation: "Growth-oriented, higher volatility, target long-term wealth",
    },
    {
      assetClass: "Bonds (Fixed Income)",
      targetPercentage: allocation.bonds,
      currentPercentage: 0,
      dollarAmount: allocation.bonds * totalValue,
      variance: 0,
      recommendation: "Income generation, stability, lower volatility",
    },
    {
      assetClass: "Cash & Equivalents",
      targetPercentage: allocation.cash,
      currentPercentage: 0,
      dollarAmount: allocation.cash * totalValue,
      variance: 0,
      recommendation: "Liquidity, emergency fund, short-term goals",
    },
  ];

  // Calculate variances
  allocations.forEach(a => {
    a.variance = a.currentPercentage - a.targetPercentage;
  });

  const riskLevelMap = {
    conservative: "Low (Stable, Predictable)",
    moderate: "Medium (Balanced Growth)",
    aggressive: "High (Growth-Focused)",
  };

  return {
    riskProfile,
    timeHorizonYears,
    allocation: allocations,
    summary: `${riskLevelMap[riskProfile]} allocation optimized for ${timeHorizonYears}-year time horizon`,
    riskLevel: riskLevelMap[riskProfile],
    expectedReturn: totalExpectedReturn,
    expectedVolatility: totalVolatility,
  };
}

/**
 * Analyze portfolio for concentration, diversification, and risk
 */
export function analyzePortfolioRisk(holdings: InvestmentAccount[]): PortfolioRiskAnalysis {
  const activeHoldings = holdings.filter(h => h.isActive);
  const totalValue = activeHoldings.reduce((sum, h) => sum + h.marketValue, 0);

  if (totalValue === 0) {
    return {
      concentrationRatio: 0,
      largestHoldingPercent: 0,
      diversificationScore: 0,
      volatilityEstimate: 0,
      correlationRisk: "No holdings",
      currencyExposure: 0,
      sectorConcentration: {},
      riskLevel: "No Risk (No Holdings)",
      recommendations: ["Build investment portfolio", "Allocate funds to investments"],
    };
  }

  // Calculate concentration
  const holdings_sorted = activeHoldings.sort((a, b) => b.marketValue - a.marketValue);
  const largestHolding = holdings_sorted[0];
  const largestHoldingPercent = largestHolding.marketValue / totalValue;
  const top5Percent = holdings_sorted
    .slice(0, 5)
    .reduce((sum, h) => sum + h.marketValue, 0) / totalValue;

  // Concentration ratio (Herfindahl index)
  const concentrationRatio = activeHoldings.reduce((sum, h) => {
    const pct = h.marketValue / totalValue;
    return sum + pct * pct;
  }, 0);

  // Diversification score (0-100, higher is better)
  const diversificationScore = Math.max(
    0,
    Math.min(100, (1 - concentrationRatio) * 125)
  );

  // Volatility estimate based on holdings
  const volatilityEstimate = activeHoldings.reduce((sum, h) => {
    const holding_vol = h.expectedAnnualReturn ? h.expectedAnnualReturn * 0.5 : 0.12; // Rough estimate
    return sum + (h.marketValue / totalValue) * holding_vol;
  }, 0);

  // Correlation risk assessment
  const correlationRisk =
    concentrationRatio > 0.5
      ? "High (Holdings very correlated)"
      : concentrationRatio > 0.3
        ? "Moderate"
        : "Low (Well diversified)";

  // Sector concentration (mock data)
  const sectorConcentration = {
    Technology: 0.25,
    Finance: 0.20,
    Healthcare: 0.15,
    Other: 0.40,
  };

  // Currency exposure (assuming single currency)
  const currencyExposure = 100; // All in home currency

  const recommendations: string[] = [];
  if (largestHoldingPercent > 0.3) {
    recommendations.push("Reduce single holding concentration (>30%)");
  }
  if (diversificationScore < 40) {
    recommendations.push("Increase number of holdings for better diversification");
  }
  if (activeHoldings.length < 5) {
    recommendations.push("Build portfolio to 8-12 holdings for adequate diversification");
  }
  if (concentrationRatio > 0.4) {
    recommendations.push("Rebalance to reduce concentration risk");
  } else {
    recommendations.push("Current diversification level is appropriate");
  }

  const riskLevelMap = {
    High: concentrationRatio > 0.5 ? "Very High" : "High",
    Moderate: "Moderate",
    Low: diversificationScore > 70 ? "Low" : "Low-Moderate",
  };

  return {
    concentrationRatio,
    largestHoldingPercent,
    diversificationScore,
    volatilityEstimate,
    correlationRisk,
    currencyExposure,
    sectorConcentration,
    riskLevel: concentrationRatio > 0.5 ? "High" : "Moderate",
    recommendations,
  };
}

/**
 * Project investment returns under multiple scenarios
 */
export function projectInvestmentReturns(
  currentValue: number,
  monthlyContribution: number,
  expectedAnnualReturn: number,
  yearsToProject: number = 20
): ReturnProjection[] {
  // Scenario returns: worst (10th percentile), base, best (90th percentile)
  const scenarios = [
    { name: "Worst Case (10th %ile)", multiplier: 0.6, percentile: 10 },
    { name: "Conservative", multiplier: 0.85, percentile: 30 },
    { name: "Base Case (Expected)", multiplier: 1.0, percentile: 50 },
    { name: "Optimistic", multiplier: 1.15, percentile: 70 },
    { name: "Best Case (90th %ile)", multiplier: 1.4, percentile: 90 },
  ];

  const projections: ReturnProjection[] = scenarios.map(scenario => {
    const annualReturn = expectedAnnualReturn * scenario.multiplier;
    let balance = currentValue;

    // Year-by-year projection
    for (let year = 0; year < yearsToProject; year++) {
      balance = balance * (1 + annualReturn) + monthlyContribution * 12;
    }

    const inflationRate = 0.03;
    const inflationAdjusted = balance / Math.pow(1 + inflationRate, yearsToProject);

    const monthlyContributionFutureValue =
      monthlyContribution * 12 * (Math.pow(1 + annualReturn, yearsToProject) - 1) / annualReturn;

    return {
      scenario: scenario.name,
      percentile: scenario.percentile,
      annualReturn,
      projectedValue: balance,
      years: yearsToProject,
      inflationAdjusted,
      monthlyContributionImpact: monthlyContributionFutureValue,
    };
  });

  return projections;
}
