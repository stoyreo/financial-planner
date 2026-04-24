---
name: data-scientist
description: Financial Data Science Analysis & AI Recommendations. Use this skill when analyzing Financial 101 Master portfolio data, generating AI-driven insights, performing statistical analysis on financial metrics, creating predictive recommendations for investments and savings optimization, or when you need actionable intelligence based on profile data. Triggers on requests like "analyze my portfolio", "give me AI recommendations", "what should I do with my investments", "optimize my financial plan", or "generate data-driven insights".
compatibility: Financial 101 Master v3.0+, Node.js 18+
---

# Data Scientist Skill - Financial Analysis & AI Recommendations

## Overview

This skill performs advanced financial data science analysis on Financial 101 Master user data, generating actionable AI recommendations across five key domains: portfolio optimization, risk assessment, tax efficiency, savings strategy, and geopolitical impact analysis.

**Use this skill when:**
- You need to analyze portfolio composition and generate optimization recommendations
- You want statistical analysis of financial health metrics
- You need predictive analysis for savings goals or investment returns
- You're generating AI-driven scenarios or recommendations
- You need risk assessment with quantified metrics
- You're analyzing tax efficiency or debt reduction strategies

## Key Functions

### 1. Analyze Portfolio Health
```
analyzePortfolioHealth(portfolioData)
Returns: { healthScore, riskLevel, diversificationScore, recommendations[] }
```
- Calculates portfolio health score (0-100)
- Identifies concentration risks
- Assesses diversification adequacy
- Generates specific optimization recommendations

### 2. Generate Investment Recommendations
```
generateInvestmentRecommendations(currentAssets, riskProfile, goals)
Returns: { assetAllocationTarget, rebalancingActions[], expectedReturn, riskAdjustment }
```
- Proposes optimal asset allocation
- Recommends specific rebalancing actions
- Projects 5/10/20-year returns
- Adjusts for risk tolerance and time horizon

### 3. Analyze Savings Potential
```
analyzeSavingsPotential(income, expenses, goals)
Returns: { savingsRate, potentialMonthly, timelineToGoal, recommendations[] }
```
- Calculates current savings rate
- Identifies optimization opportunities
- Projects timeline to financial goals
- Generates expense reduction strategies

### 4. Risk Assessment & Stress Testing
```
performRiskAssessment(portfolio, financialProfile)
Returns: { volatilityScore, stressTestResults, emergencyFundAdequacy, exposures[] }
```
- Quantifies portfolio volatility
- Runs stress tests (market downturn, job loss, rate increase)
- Assesses emergency fund adequacy
- Identifies vulnerability areas

### 5. Geopolitical Impact Analysis
```
analyzeGeopoliticalRisk(portfolio, commodityExposure)
Returns: { riskScore, hedgeRecommendations, commodityAllocation, scenarioImpacts[] }
```
- Scores geopolitical risk (0-10 scale)
- Recommends gold/commodity hedges
- Analyzes energy/oil exposure
- Projects portfolio impact in crisis scenarios

## Output Format

All functions return structured JSON with:
- **metrics**: Quantified analysis results
- **recommendations**: Actionable next steps
- **confidence**: Confidence score (0-100)
- **explanation**: Plain-language reasoning
- **timeline**: Expected timeframe for results

## Example Usage

```
User: "Analyze my portfolio and tell me what I should do"

Skill performs:
1. Analyze portfolio health and current composition
2. Run risk assessment with stress testing
3. Generate asset allocation recommendations
4. Calculate expected returns by scenario
5. Identify tax efficiency opportunities
6. Return comprehensive analysis with prioritized recommendations
```

## Data Requirements

For optimal analysis, provide:
- Portfolio holdings (assets, quantities, current values)
- Income and expense data
- Investment goals and timelines
- Risk tolerance level
- Current savings rate
- Debt levels and payment schedules
- Tax bracket information
- Emergency fund status

## Confidence Scoring

Recommendations include confidence scores based on:
- Data completeness (more data = higher confidence)
- Historical accuracy of similar recommendations
- Market stability indicators
- Portfolio size and diversification level

## Notes

- All projections assume Thai market conditions and regulations
- Returns are risk-adjusted and inflation-adjusted where applicable
- Analysis respects user's risk tolerance and personal goals
- Recommendations are starting points; users should consult advisors for major decisions
- Data is processed locally; no external APIs required
