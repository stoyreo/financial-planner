---
name: uat-validator
description: User Acceptance Testing (UAT) & Quality Assurance for Financial 101 Master. Use this skill to perform comprehensive system testing, validate feature functionality, verify data integrity, test account switching and multi-user workflows, validate Google Drive sync, test mortgage simulator accuracy, verify AI insights quality, and generate UAT reports. Triggers on requests like "run UAT", "test the app", "validate features", "check if everything works", "system testing", "QA testing", or "generate UAT report".
compatibility: Financial 101 Master v3.0+, All features
---

# UAT Validator Skill - Quality Assurance & System Testing

## Overview

This skill performs comprehensive User Acceptance Testing (UAT) across all Financial 101 Master features, validating functionality, data integrity, performance, and user experience. It provides systematic testing of all v3.0 features with detailed reporting.

**Use this skill when:**
- You need to validate Financial 101 Master functionality before release
- You're testing account switching and multi-user workflows
- You need to verify Google Drive sync operations
- You're validating mortgage simulator calculations and accuracy
- You need to test AI insights generation and quality
- You want comprehensive QA testing with detailed reports
- You need to verify data integrity across all accounts
- You're checking for regression issues or compatibility problems

## Testing Domains

### 1. Core Application Testing
```
testCoreApplicationFeatures()
Returns: { testsPassed, testsFailed, coverage%, issues[] }
```
Tests:
- Application startup and initialization
- Page navigation and routing
- Component rendering and layout
- Responsive design (desktop, tablet, mobile)
- Error handling and edge cases
- Performance metrics (load times)
- Browser compatibility

### 2. Account Management Testing
```
testAccountSwitching()
Returns: { successRate%, failedScenarios[], dataIsolation: bool, recommendations[] }
```
Tests:
- User login and authentication
- Account creation and deletion
- Switching between accounts
- Data isolation per account
- Permission enforcement (read/write access)
- Session persistence
- Multi-user concurrent access scenarios

### 3. Google Drive Integration Testing
```
testGoogleDriveSync()
Returns: { syncSuccess: bool, backupCount, integrityChecksPassed: bool, issues[] }
```
Tests:
- OAuth2 authentication flow
- Initial sync and data upload
- Auto-sync on 30-minute interval
- Manual backup/restore operations
- Backup versioning and pruning
- Data integrity after restore
- Error handling for network failures
- File naming and organization

### 4. Mortgage Simulator & Debt Management Testing
```
testMortgageSimulator()
Returns: { calculationAccuracy: %, selectionSystem: bool, payoffYears: bool, issues[] }
```
Tests:
- Debt item selection (individual and all)
- Payoff year calculations accuracy
- Mortgage simulator parameter variations
- Extra payment scenarios
- Interest rate adjustments
- Amortization table accuracy
- Balance chart visualization
- Multi-debt simulation handling

### 5. AI Scenarios & Insights Testing
```
testAIFeatures()
Returns: { scenarioQuality: score, insightsRelevance: %, expertSkillsWorking: bool, issues[] }
```
Tests:
- 5 Scenario Planner analyses:
  * Investment optimization accuracy
  * Tax planning recommendations
  * Risk assessment calculations
  * Savings strategy viability
  * Geopolitics impact analysis
- AI insights per menu (Income, Expenses, Investments, Debts, Scenarios)
- Expert advisor skills (Life/Retirement, Investment)
- Recommendation relevance and actionability
- Confidence scoring accuracy

### 6. Data & Calculations Testing
```
testDataIntegrity()
Returns: { integrityScore: %, calculationAccuracy: %, issues[] }
```
Tests:
- Data consistency across pages
- Calculation accuracy (income, expenses, debt, forecasts)
- Number formatting and currency display
- Chart and visualization accuracy
- Report generation correctness
- Data export/import validation

### 7. User Experience Testing
```
testUserExperience()
Returns: { usabilityScore: %, feedbackItems: [], recommendations[] }
```
Tests:
- Navigation intuitiveness
- UI responsiveness and timing
- Error message clarity
- Form validation and feedback
- Mobile usability
- Accessibility (keyboard navigation, screen reader)
- Performance on slower connections

### 8. Regression Testing
```
testRegressionIssues()
Returns: { newIssuesFound: count, previousIssuesFixed: bool, regressions: [] }
```
Tests:
- Existing v2.0 features still work
- No breaking changes to data structure
- Backward compatibility
- Account migration integrity
- OneDrive→GoogleDrive transition
- Previous user data accessibility

## Test Report Format

All UAT runs produce standardized reports with:

```json
{
  "testSuite": "Financial 101 Master UAT v3.0",
  "timestamp": "2026-04-15T14:32:00Z",
  "totalTests": 156,
  "passed": 152,
  "failed": 4,
  "skipped": 0,
  "successRate": "97.4%",
  "coverage": {
    "featuresCovered": ["Accounts", "GoogleDrive", "MortgageSimulator", "AIInsights", "ExpertAdvisors"],
    "pagesCovered": ["dashboard", "debts", "investments", "scenarios", "profile"],
    "estimatedCodeCoverage": "92%"
  },
  "criticalIssues": [],
  "minorIssues": [
    {
      "id": "UAT-4-1",
      "title": "PayoffYear calculation off by 1 month in edge case",
      "severity": "low",
      "steps": "...",
      "recommendation": "Fix rounding in calculatePayoffYear()"
    }
  ],
  "recommendations": [
    "Address critical issue UAT-1-2 before release",
    "Optimize Google Drive sync timeout (currently 30s, suggest 45s)",
    "Add loading indicator for AI insights generation"
  ],
  "nextSteps": [
    "Developer fixes for identified issues",
    "Regression testing of fixes",
    "Final UAT sign-off",
    "Production release authorization"
  ]
}
```

## Success Criteria for Release

Application meets UAT requirements when:
- ✅ Overall success rate ≥ 95%
- ✅ Zero critical issues (severity = critical)
- ✅ All core features passing (accounts, Google Drive, scenarios, debts)
- ✅ No regressions from v2.0
- ✅ Data integrity verified
- ✅ Performance acceptable on standard hardware
- ✅ Mobile usability passing on iOS and Android browsers

## Test Environment Requirements

- Node.js 18+
- Chrome/Firefox/Safari (latest)
- Test accounts with varied data profiles
- Google Drive test folder configured
- Network connectivity for OAuth2 and cloud sync

## Sample Execution

```
User: "Run UAT on Financial 101 Master v3.0"

Skill performs:
1. Run all 156 tests across 8 domains
2. Validate calculations and data integrity
3. Test all user workflows
4. Generate comprehensive report
5. Identify issues and recommendations
6. Produce release authorization assessment
```

## Output Examples

### Successful UAT
```
✅ UAT PASSED - Ready for Release
   Success Rate: 98.1% (153/156 tests)
   Critical Issues: 0
   Recommendations: 3 (all low-priority, can defer to v3.1)
```

### UAT with Issues
```
⚠️  UAT CONDITIONAL PASS - Fix Critical Issues First
   Success Rate: 94.5% (147/156 tests)
   Critical Issues: 2 (OAuth flow, payoff calculation)
   Blocked: Production release until fixed
   Timeline: Fix estimated 4-6 hours
```

## Continuous Monitoring

After release, UAT continues to:
- Monitor user-reported issues
- Track performance metrics
- Validate new account creation workflows
- Verify Google Drive sync reliability
- Check for calculation drift or errors
- Alert on anomalies or failures

## Report Deliverables

UAT produces:
1. **UAT_REPORT.md** - Full test results and recommendations
2. **ISSUE_LOG.json** - Detailed issue tracking with IDs
3. **TEST_COVERAGE.json** - Coverage metrics and gap analysis
4. **RELEASE_CHECKLIST.md** - Go/no-go decision points
5. **USER_FEEDBACK_SUMMARY.md** - Qualitative feedback collected
