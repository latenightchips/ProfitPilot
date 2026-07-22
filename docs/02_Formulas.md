# 02_FORMULAS

Project

ProfitPilot

Page

1 of 10

Title

Mathematical Philosophy & Formula Standards

Version

1.0

Status

Draft

Dependencies

01_PRD.md

---

# PURPOSE

This document defines every mathematical formula used by ProfitPilot.

The objective is to ensure that every displayed value is

Consistent

Transparent

Verifiable

Repeatable

Explainable

Every calculation must originate from this document.

No formula may exist only in source code.

---

# DESIGN PRINCIPLES

Every mathematical model must satisfy the following principles.

Correctness

↓

Determinism

↓

Transparency

↓

Explainability

↓

Testability

If a calculation cannot be explained,

it should not exist.

---

# MATHEMATICAL PHILOSOPHY

ProfitPilot does not predict markets.

ProfitPilot evaluates portfolios.

The mathematical engine answers questions such as

How much can I borrow?

What is my Health Factor?

How much interest will I pay?

What happens if BTC reaches $150,000?

At what BTC price will liquidation occur?

What is the safest leverage level?

The engine provides calculations,

not opinions.

---

# SOURCE OF TRUTH

Every formula must originate from one of the following.

Official Aave Documentation

Official Protocol Documentation

Financial Mathematics

Well-established Accounting Principles

Verified Internal Models

Experimental formulas must be clearly marked.

---

# PRECISION STANDARD

Internal Calculations

64-bit floating point.

Displayed Values

Currency

2 decimals

Percentages

2 decimals

BTC

8 decimals

Health Factor

3 decimals

Interest Rate

3 decimals

Internal calculations should retain maximum precision.

Only presentation layers perform rounding.

---

# ROUNDING POLICY

Never round intermediate calculations.

Correct

Full Precision

↓

Final Result

↓

Display

Incorrect

Round

↓

Calculate Again

↓

Round Again

Repeated rounding introduces cumulative error.

---

# UNIT STANDARDS

All formulas must define units explicitly.

Examples

BTC

USD

USDC

ETH

%

APR

Days

Years

Ratios

No calculation should mix incompatible units.

---

# VARIABLE NAMING

Use consistent notation.

BTC

Bitcoin Holdings

P

BTC Price

USD

C

Collateral Value

USD

D

Debt

USD

HF

Health Factor

LTV

Loan-to-Value

LT

Liquidation Threshold

APR

Annual Percentage Rate

APY

Annual Percentage Yield

L

Effective Leverage

Variable names remain identical across documentation and source code.

---

# FORMULA TEMPLATE

Every formula follows the same structure.

Purpose

Description

Equation

Variables

Units

Assumptions

Example

Edge Cases

Complexity

Verification

Unit Tests

No formula is considered complete without all sections.

---

# ERROR TOLERANCE

Maximum acceptable calculation error

0.01%

Maximum floating-point drift

Machine precision

Formula changes require benchmark comparison against previous results.

---

# DEPENDENCIES

Some formulas depend on others.

Example

Portfolio Value

↓

Collateral Value

↓

Borrow Capacity

↓

Health Factor

↓

Liquidation Price

↓

Risk Score

The dependency chain should remain acyclic.

---

# IMPLEMENTATION RULES

Every formula must

Be deterministic.

Avoid hidden constants.

Document assumptions.

Handle invalid inputs.

Avoid division by zero.

Return explicit errors for impossible states.

Be independently testable.

---

# VALIDATION STRATEGY

Each formula must be verified using

Manual Calculation

Spreadsheet Verification

Known Examples

Official Documentation

Automated Unit Tests

Benchmark Datasets

No implementation is accepted without verification.

---

# PERFORMANCE TARGETS

Individual Formula

<1 ms

Portfolio Calculation

<50 ms

Scenario Simulation

<100 ms

Mathematical correctness always takes priority over micro-optimizations.

---

# FORMULA CHANGE POLICY

Any modification to an existing formula requires

Reason for Change

Impact Analysis

Regression Tests

Documentation Update

Version Increment

Previous formulas should remain archived for historical reference.

---

# DOCUMENT STRUCTURE

Page 1

Mathematical Standards

Page 2

Portfolio Metrics

Page 3

Leverage & Loop Mathematics

Page 4

Aave Risk Formulas

Page 5

Interest Calculations

Page 6

Exit Strategy Mathematics

Page 7

Scenario Simulation

Page 8

Recommendation Engine

Page 9

Performance Metrics

Page 10

Validation & Test Cases

---

# ACCEPTANCE CRITERIA

This page is complete when

✓ Mathematical philosophy is defined.

✓ Precision standards are documented.

✓ Variable naming is standardized.

✓ Formula template is established.

✓ Validation strategy is defined.

✓ Performance targets are documented.

✓ Change management process exists.

---

END OF PAGE 1

NEXT

Page 2

Portfolio Metrics

# 02_FORMULAS

Project

ProfitPilot

Page

2 of 10

Title

Portfolio Metrics

Version

1.0

Dependencies

01_PRD.md

---

# PURPOSE

Portfolio Metrics form the mathematical foundation of ProfitPilot.

Every calculation in the application ultimately depends on these values.

The objective is to establish a single, consistent source of truth for portfolio valuation before introducing borrowing, leverage, or risk calculations.

---

# FORMULA 001

Portfolio Value

Purpose

Calculate the current market value of all portfolio assets.

Human Explanation

The value of a portfolio equals the quantity of each asset multiplied by its current market price.

Equation

Portfolio Value = Σ(Asset Amount × Asset Price)

Variables

Asset Amount

Quantity of the asset.

Unit

Asset

Asset Price

Current market value.

Unit

USD

Portfolio Value

Total portfolio valuation.

Unit

USD

Example

BTC Holdings

2 BTC

BTC Price

$50,000

Portfolio Value

2 × 50,000

=

$100,000

TypeScript

```ts
portfolioValue = assets.reduce(
    (sum, asset) => sum + asset.amount * asset.price,
    0
);
```

Edge Cases

No assets

Portfolio Value = 0

Negative holdings

Invalid

Unknown price

Calculation blocked

Unit Tests

2 BTC × $50,000

=

$100,000

0 BTC

=

$0

---

# FORMULA 002

Collateral Value

Purpose

Calculate the value of assets supplied as collateral.

Human Explanation

Not every portfolio asset is necessarily used as collateral.

Collateral Value includes only assets actively deposited into lending protocols.

Equation

Collateral Value = Σ(Collateral Amount × Market Price)

Variables

Collateral Amount

Deposited quantity.

Market Price

Current price.

Collateral Value

USD

Example

BTC Deposited

1.5 BTC

BTC Price

$40,000

Collateral

$60,000

TypeScript

```ts
collateralValue =
    collateralAmount * btcPrice;
```

Edge Cases

No collateral

=

0

---

# FORMULA 003

Debt Value

Purpose

Calculate the total borrowed amount.

Explanation

Debt is measured using the borrowed asset.

Version 1

Only stablecoins.

Equation

Debt Value = Borrowed Stablecoins

Variables

Debt

Outstanding borrow.

USD

Example

Borrowed

$22,500 USDC

Debt Value

$22,500

TypeScript

```ts
debtValue = borrowedUSDC;
```

Future Versions

Multiple borrowed assets.

---

# FORMULA 004

Net Portfolio Value

Purpose

Determine actual ownership.

Human Explanation

Net Worth equals

Assets

minus

Debt.

Equation

Net Value

=

Portfolio Value − Debt

Variables

Portfolio Value

USD

Debt

USD

Net Value

USD

Example

Portfolio

$120,000

Debt

$30,000

Net Worth

$90,000

TypeScript

```ts
netWorth =
    portfolioValue - debtValue;
```

Edge Cases

Debt larger than assets

Negative equity

Allowed

Displayed as warning

---

# FORMULA 005

Equity Ratio

Purpose

Measure ownership percentage.

Human Explanation

How much of the portfolio actually belongs to the user.

Equation

Equity Ratio

=

Net Worth

/

Portfolio Value

Variables

Net Worth

USD

Portfolio Value

USD

Result

Percentage

Example

Portfolio

100,000

Debt

30,000

Net Worth

70,000

Equity Ratio

70%

TypeScript

```ts
equityRatio =
    netWorth /
    portfolioValue;
```

Edge Cases

Portfolio Value

0

Return

0%

---

# FORMULA 006

Debt Ratio

Purpose

Measure leverage through debt.

Equation

Debt Ratio

=

Debt

/

Portfolio Value

Example

Debt

40,000

Portfolio

100,000

Debt Ratio

40%

TypeScript

```ts
debtRatio =
    debtValue /
    portfolioValue;
```

Interpretation

Lower

Safer

Higher

Riskier

---

# FORMULA 007

Portfolio Gain

Purpose

Measure unrealized profit.

Equation

Gain

=

Current Value − Initial Investment

Variables

Current Portfolio

Initial Capital

Gain

USD

Example

Started

$50,000

Current

$82,000

Gain

$32,000

TypeScript

```ts
gain =
    portfolioValue -
    initialInvestment;
```

---

# FORMULA 008

Portfolio Return

Purpose

Measure percentage return.

Equation

Return %

=

Gain

/

Initial Investment

×

100

Example

Gain

$30,000

Initial

$60,000

Return

50%

TypeScript

```ts
returnPct =
gain /
initialInvestment *
100;
```

---

# FORMULA DEPENDENCY GRAPH

Initial Investment

↓

Portfolio Value

↓

Collateral Value

↓

Debt

↓

Net Worth

↓

Debt Ratio

↓

Equity Ratio

↓

Leverage

↓

Health Factor

↓

Liquidation

↓

Recommendation Engine

This dependency graph must remain acyclic.

---

# IMPLEMENTATION NOTES

These formulas intentionally avoid protocol-specific logic.

Protocol rules are introduced beginning on

Page 4

Aave Risk Mathematics.

This separation keeps the Portfolio Engine independent from lending protocol implementations.

---

# ACCEPTANCE CRITERIA

✓ Portfolio Value correctly sums all assets.

✓ Collateral Value includes only collateralized assets.

✓ Debt Value supports stablecoin borrowing.

✓ Net Worth is calculated correctly.

✓ Equity Ratio and Debt Ratio are accurate.

✓ Portfolio Gain and Return are deterministic.

✓ All formulas include examples and unit tests.

---

END OF PAGE 2

NEXT

Page 3

Leverage & Loop Mathematics

# 02_FORMULAS

Project

ProfitPilot

Page

3 of 10

Title

Leverage & Loop Mathematics

Version

1.0

Dependencies

F-001 → F-008

---

# PURPOSE

Leverage mathematics defines how borrowing against collateral increases market exposure.

These formulas model recursive borrowing ("looping") strategies commonly used on Aave.

The objective is to calculate exposure, leverage, borrowing capacity and loop efficiency while remaining independent from market predictions.

---

# LEVERAGE PRINCIPLES

Leverage increases

Potential Returns

↓

Potential Losses

↓

Liquidation Risk

ProfitPilot models leverage mathematically.

It never recommends leverage without displaying the associated risks.

---

# F-010

Exposure

Purpose

Calculate total market exposure.

Human Explanation

Exposure represents the total value invested in BTC after all borrowing and re-buying operations.

Equation

Exposure = Total BTC Holdings × BTC Price

Variables

BTC Holdings

BTC

BTC Price

USD

Exposure

USD

Example

3 BTC

BTC Price

$60,000

Exposure

$180,000

TypeScript

```ts
exposure = btcHoldings * btcPrice;
```

Edge Cases

No BTC

Exposure = 0

---

# F-011

Effective Leverage

Purpose

Measure leverage multiple.

Human Explanation

Shows how much larger market exposure is compared to user equity.

Equation

Effective Leverage

=

Exposure

/

Net Worth

Variables

Exposure

USD

Net Worth

USD

Result

Multiplier

Example

Exposure

$180,000

Net Worth

$100,000

Leverage

1.80×

TypeScript

```ts
effectiveLeverage =
    exposure /
    netWorth;
```

Interpretation

1×

No leverage

2×

Twice market exposure

3×

Triple exposure

---

# F-012

Borrow Capacity

Purpose

Maximum safe borrowing amount.

Equation

Borrow Capacity

=

Collateral Value × Maximum LTV

Variables

Collateral Value

USD

Maximum LTV

%

Borrow Capacity

USD

Example

Collateral

$100,000

LTV

70%

Borrow Capacity

$70,000

TypeScript

```ts
borrowCapacity =
collateralValue *
maxLTV;
```

---

# F-013

Available Borrow

Purpose

Remaining borrowing power.

Equation

Available Borrow

=

Borrow Capacity − Current Debt

Example

Borrow Capacity

$70,000

Debt

$45,000

Available

$25,000

TypeScript

```ts
availableBorrow =
borrowCapacity -
debtValue;
```

---

# F-014

Loop Capital

Purpose

Capital deployed in one loop.

Human Explanation

Each borrowing cycle creates additional purchasing power.

Equation

Loop Capital

=

Borrow Amount

Variables

Borrow Amount

USD

Loop Capital

USD

Example

Borrow

$30,000

Loop Capital

$30,000

---

# F-015

BTC Purchased Per Loop

Purpose

Determine BTC acquired.

Equation

BTC Bought

=

Borrow Amount

/

BTC Price

Example

Borrow

$30,000

BTC Price

$60,000

BTC Purchased

0.50 BTC

TypeScript

```ts
btcPurchased =
borrowAmount /
btcPrice;
```

---

# F-016

Recursive Exposure

Purpose

Calculate cumulative exposure.

Equation

Exposure

=

Initial BTC

+

BTC Loop 1

+

BTC Loop 2

+

...

+

BTC Loop N

Human Explanation

Every completed loop increases total BTC holdings.

Future exposure equals the sum of every purchase.

---

# F-017

Loop Efficiency

Purpose

Evaluate borrowed capital efficiency.

Equation

Loop Efficiency

=

Exposure

/

Debt

Variables

Exposure

USD

Debt

USD

Example

Exposure

$180,000

Debt

$60,000

Efficiency

3.0

Higher values indicate more exposure per borrowed dollar.

---

# F-018

Maximum Loop Count

Purpose

Estimate practical loop limit.

Equation

Maximum Loops

depends on

Target Health Factor

Minimum Borrow Size

Transaction Costs

Borrow APR

Protocol Constraints

Human Explanation

ProfitPilot intentionally avoids a fixed mathematical formula.

The Loop Simulator determines this iteratively.

Pseudo Algorithm

while

Health Factor > Target

Borrow

↓

Buy BTC

↓

Deposit BTC

↓

Repeat

Stop when

Target Health Factor reached.

---

# F-019

Loop Amplification Ratio

Purpose

Measure portfolio expansion.

Equation

Amplification

=

Final Exposure

/

Initial Capital

Example

Initial

$100,000

Exposure

$235,000

Amplification

2.35×

TypeScript

```ts
amplification =
finalExposure /
initialCapital;
```

---

# LOOP DEPENDENCY GRAPH

Initial Capital

↓

Collateral

↓

Borrow Capacity (F-012)

↓

Borrow

↓

BTC Purchase (F-015)

↓

Collateral

↓

Borrow Again

↓

Exposure (F-010)

↓

Effective Leverage (F-011)

↓

Loop Efficiency (F-017)

↓

Maximum Loop Count (F-018)

↓

Recommendation Engine

---

# ENGINEERING NOTES

Loop calculations intentionally avoid protocol-specific liquidation rules.

Protocol-specific constraints are introduced in

Page 4

Aave Risk Mathematics.

This separation allows the Loop Engine to remain reusable across different lending protocols.

---

# UNIT TEST EXAMPLES

Scenario A

Initial BTC

1.00 BTC

BTC Price

$50,000

Loop Borrow

$25,000

Expected BTC Bought

0.50 BTC

Expected Exposure

$75,000

---

Scenario B

Initial Capital

$100,000

Exposure

$220,000

Expected Leverage

2.20×

---

Scenario C

Collateral

$120,000

Maximum LTV

70%

Expected Borrow Capacity

$84,000

---

# ACCEPTANCE CRITERIA

✓ Effective leverage matches expected exposure.

✓ Borrow capacity respects protocol limits.

✓ Loop calculations remain deterministic.

✓ Exposure increases correctly after each loop.

✓ Maximum loop calculation is iterative.

✓ All formulas include examples.

✓ All formulas include implementation guidance.

✓ Formula IDs F-010 through F-019 are reserved and documented.

---

END OF PAGE 3

NEXT

Page 4

Aave Risk Mathematics

# 02_FORMULAS

Project

ProfitPilot

Page

4 of 10

Title

Aave Risk Mathematics

Version

1.0

Dependencies

F-001 → F-019

---

# PURPOSE

This chapter defines the mathematical model used to evaluate lending risk.

These formulas determine

Borrow safety

↓

Health Factor

↓

Liquidation Risk

↓

Maximum Safe Borrow

↓

Recommended Loop Count

Risk calculations are protocol-aware.

Version 1.0 supports Aave V3.

Future versions may support additional lending protocols.

---

# RISK PHILOSOPHY

Risk is determined by protocol rules.

ProfitPilot never invents its own liquidation logic.

The application evaluates

Current Risk

↓

Future Risk

↓

Worst Case Risk

↓

Recovery Options

The objective is to prevent liquidation before it becomes possible.

---

# F-020

Loan-to-Value (LTV)

Purpose

Measure borrowing relative to collateral.

Equation

LTV = Debt / Collateral Value

Variables

Debt

USD

Collateral Value

USD

Result

%

Example

Collateral

$100,000

Debt

$50,000

LTV

50%

TypeScript

```ts
ltv = debtValue / collateralValue;
```

Interpretation

Lower

Safer

Higher

More aggressive

---

# F-021

Maximum Borrow Limit

Purpose

Determine protocol borrowing limit.

Equation

Maximum Borrow

=

Collateral Value

×

Maximum LTV Parameter

Variables

Maximum LTV

Loaded from protocol configuration.

Example

Collateral

$100,000

Protocol LTV

70%

Maximum Borrow

$70,000

---

# F-022

Health Factor

Purpose

Measure liquidation safety.

Human Explanation

Health Factor is the single most important safety metric.

Above 1.0

Safe

Near 1.0

Danger

Below 1.0

Liquidation

Equation

Health Factor

=

(Collateral Value × Liquidation Threshold)

/

Debt

Variables

Collateral Value

USD

Liquidation Threshold

Protocol Parameter

Debt

USD

Example

Collateral

$100,000

Threshold

80%

Debt

$50,000

HF

1.60

TypeScript

```ts
healthFactor =
(collateralValue * liquidationThreshold)
/
debtValue;
```

---

# F-023

Distance to Liquidation

Purpose

Measure remaining safety margin.

Equation

Distance

=

Health Factor

−

1.0

Example

HF

1.75

Distance

0.75

Interpretation

Higher

Safer

Lower

Riskier

---

# F-024

Liquidation Price

Purpose

Calculate BTC price triggering liquidation.

Human Explanation

This is the BTC price where Health Factor reaches exactly 1.0.

Equation

Liquidation Price

=

Current BTC Price

×

(Debt)

/

(Collateral Value × Liquidation Threshold)

Example

BTC

$60,000

Collateral

$120,000

Debt

$70,000

Threshold

80%

Liquidation Price

≈ $43,750

TypeScript

```ts
liquidationPrice =
btcPrice *
(
debtValue /
(
collateralValue *
liquidationThreshold
)
);
```

---

# F-025

Liquidation Buffer

Purpose

Determine remaining downside.

Equation

Buffer %

=

(Current Price − Liquidation Price)

/

Current Price

×

100

Example

BTC

$60,000

Liquidation

$45,000

Buffer

25%

Interpretation

Large Buffer

Low Risk

Small Buffer

High Risk

---

# F-026

Risk Category

Purpose

Convert Health Factor into human-readable risk.

Rules

HF ≥ 2.00

Very Safe

HF 1.70–1.99

Safe

HF 1.50–1.69

Moderate

HF 1.30–1.49

High Risk

HF 1.10–1.29

Critical

HF <1.10

Extreme

These thresholds should remain configurable.

---

# F-027

Maximum Additional Debt

Purpose

Calculate remaining borrow capacity while maintaining a target Health Factor.

Equation

Max Additional Debt

=

((Collateral × Liquidation Threshold)
/ Target HF)

− Current Debt

Example

Collateral

$120,000

LT

80%

Target HF

1.80

Current Debt

$40,000

Result

Remaining safe borrow

TypeScript

```ts
maxAdditionalDebt =
(
(collateralValue * liquidationThreshold)
/
targetHF
)
-
debtValue;
```

---

# F-028

Health Factor After Price Change

Purpose

Project future safety.

Equation

Future HF

=

(New Collateral Value × Liquidation Threshold)

/

Debt

Used by

Scenario Simulator

Monte Carlo

Exit Planner

Recommendation Engine

---

# F-029

Protocol Safety Score

Purpose

Normalize protocol risk into a score.

Example Scale

Health Factor

↓

Risk Score

HF ≥2.20

100

HF 2.00

95

HF 1.80

85

HF 1.60

70

HF 1.40

50

HF 1.20

25

HF ≤1.00

0

This score feeds the Recommendation Engine.

---

# FORMULA DEPENDENCY GRAPH

Portfolio Value

↓

Collateral

↓

LTV (F-020)

↓

Maximum Borrow (F-021)

↓

Health Factor (F-022)

↓

Distance to Liquidation (F-023)

↓

Liquidation Price (F-024)

↓

Buffer (F-025)

↓

Risk Category (F-026)

↓

Recommendation Engine

↓

Exit Strategy

---

# IMPLEMENTATION NOTES

Protocol parameters must never be hardcoded.

Required runtime parameters

Maximum LTV

Liquidation Threshold

Liquidation Bonus

Borrow APR

Supply APR

Reserve Factor

Every supported protocol should expose these values through a common interface.

---

# UNIT TEST EXAMPLES

Scenario A

Collateral

$100,000

Debt

$50,000

Threshold

80%

Expected HF

1.60

---

Scenario B

BTC Price

$60,000

Liquidation

$45,000

Expected Buffer

25%

---

Scenario C

Target HF

1.80

Collateral

$150,000

Expected Borrow Capacity

Matches protocol rules

---

# ACCEPTANCE CRITERIA

✓ LTV calculations match protocol documentation.

✓ Health Factor matches Aave calculations within tolerance.

✓ Liquidation price is deterministic.

✓ Buffer calculations remain accurate.

✓ Risk categories are configurable.

✓ Runtime protocol parameters replace hardcoded values.

✓ Formula IDs F-020 through F-029 are documented.

---

END OF PAGE 4

NEXT

Page 5

Interest Accrual & Cost Mathematics

# 02_FORMULAS

Project

ProfitPilot

Page

5 of 10

Title

Interest Accrual & Position Decay Mathematics

Version

1.0

Dependencies

F-001 → F-029

---

# PURPOSE

This chapter defines how borrowing costs affect leveraged positions over time.

Unlike previous chapters, these formulas introduce the dimension of time.

The objective is to answer questions such as

How much interest will I pay?

↓

How much will my debt grow?

↓

How does my Health Factor change over time?

↓

When does my position become dangerous if BTC remains unchanged?

↓

What BTC appreciation is required to offset borrowing costs?

These calculations assume no liquidation events occur.

---

# TIME PHILOSOPHY

A leveraged position is never static.

Even if BTC price remains constant

↓

Debt increases.

↓

Health Factor decreases.

↓

Liquidation Price rises.

↓

Risk slowly increases.

Time itself becomes a source of risk.

---

# F-030

Daily Interest

Purpose

Calculate daily borrowing cost.

Equation

Daily Interest

=

Debt

×

APR

/

365

Variables

Debt

USD

APR

Annual Borrow Rate

Daily Interest

USD

Example

Debt

$50,000

APR

5%

Daily Interest

$6.85

TypeScript

```ts
dailyInterest =
debt *
apr /
365;
```

---

# F-031

Monthly Interest

Purpose

Estimate monthly borrowing cost.

Equation

Monthly Interest

=

Daily Interest

×

30

Example

Daily

$6.85

Monthly

$205.50

---

# F-032

Annual Interest

Purpose

Estimate yearly borrowing cost.

Equation

Annual Interest

=

Debt

×

APR

Example

Debt

$50,000

APR

5%

Annual

$2,500

---

# F-033

Debt Growth

Purpose

Calculate future debt.

Equation

Future Debt

=

Current Debt

+

Accrued Interest

Example

Debt

$50,000

Interest

$2,500

Future Debt

$52,500

Future versions may support continuous compounding.

---

# F-034

Position Decay

Purpose

Measure debt growth relative to equity.

Equation

Decay %

=

Future Debt

/

Current Debt

−1

Example

Debt

50,000

Future

52,500

Decay

5%

Interpretation

Higher values indicate greater erosion of borrowing capacity.

---

# F-035

Health Factor Over Time

Purpose

Project Health Factor assuming constant collateral value.

Equation

Future HF

=

(Collateral × Liquidation Threshold)

/

Future Debt

Example

Collateral

$100,000

Future Debt

$52,500

LT

80%

Future HF

1.52

Used by

Risk Engine

Scenario Simulator

Exit Planner

---

# F-036

Liquidation Price Over Time

Purpose

Estimate future liquidation price.

Equation

Future Liquidation Price

=

Future Debt

/

BTC Holdings × Liquidation Threshold

Human Explanation

As debt increases,

the liquidation price slowly moves upward.

---

# F-037

Break-Even BTC Appreciation

Purpose

Determine BTC appreciation required to offset borrowing costs.

Equation

Required Return

=

Annual Interest

/

Exposure

Example

Interest

$2,500

Exposure

$150,000

Required Return

1.67%

Interpretation

BTC must appreciate at least this percentage for the leveraged position to outperform an equivalent unleveraged position before considering other costs.

---

# F-038

Time to Target Health Factor

Purpose

Estimate when Health Factor reaches a user-defined threshold.

Inputs

Current Debt

APR

Collateral

Target HF

Method

Iterative Simulation

Example

Current HF

1.80

Target

1.50

APR

5%

Estimated Time

≈ 430 Days

Used by

Recommendation Engine

Alerts

Exit Planner

---

# F-039

Time to Danger

Purpose

Estimate when the position becomes unsafe.

Definition

Time required for

Health Factor

↓

Target Safety Threshold

assuming

No BTC price change

Constant APR

No repayments

No additional collateral

Method

Daily simulation

Pseudo Algorithm

Day 0

↓

Increase Debt

↓

Recalculate HF

↓

Repeat

↓

Stop when

HF ≤ Target

Outputs

Days

Months

Years

Risk Level

Interpretation

Long Time

Low Time Risk

Short Time

High Time Risk

---

# TIME DEPENDENCY GRAPH

Borrow APR

↓

Daily Interest (F-030)

↓

Future Debt (F-033)

↓

Health Factor (F-035)

↓

Liquidation Price (F-036)

↓

Time to Target HF (F-038)

↓

Time to Danger (F-039)

↓

Recommendation Engine

↓

Exit Planner

---

# IMPLEMENTATION NOTES

Time calculations should support

Daily

Weekly

Monthly

Quarterly

Yearly

Future versions

Variable APR

Compounding Interest

Historical Interest Rates

---

# UNIT TEST EXAMPLES

Scenario A

Debt

$40,000

APR

6%

Expected Daily Interest

≈ $6.58

---

Scenario B

Debt

$50,000

APR

5%

Expected Annual Interest

$2,500

---

Scenario C

Collateral

$100,000

Debt

$50,000

APR

5%

Target HF

1.50

Expected Time

Finite and deterministic

---

# ACCEPTANCE CRITERIA

✓ Interest calculations match APR.

✓ Debt growth is deterministic.

✓ Position Decay is correctly computed.

✓ Health Factor projections are accurate.

✓ Break-even appreciation is calculated.

✓ Time to Target HF uses iterative simulation.

✓ Time to Danger is implemented.

✓ Formula IDs F-030 through F-039 are documented.

---

END OF PAGE 5

NEXT

Page 6

Exit Strategy Mathematics

# 02_FORMULAS

Project

ProfitPilot

Page

6 of 10

Title

Exit Strategy Mathematics

Version

1.0

Dependencies

F-001 → F-039

---

# PURPOSE

The Exit Engine transforms mathematical calculations into actionable decisions.

Rather than only reporting portfolio status, it evaluates potential exit strategies and recommends actions that maintain or improve portfolio safety while respecting the user's goals.

The Exit Engine never executes transactions.

It provides transparent recommendations.

---

# EXIT PHILOSOPHY

The objective is not simply to maximize profit.

The objective is to

Protect Capital

↓

Reduce Risk

↓

Lock In Gains

↓

Maintain Flexibility

↓

Avoid Liquidation

Every recommendation should explain its reasoning.

---

# USER EXIT GOALS

The Exit Engine supports multiple objectives.

Preserve Capital

Maximize BTC Holdings

Reduce Debt

Reach Target Health Factor

Take Partial Profit

Fully Exit Position

Each goal produces different recommendations.

---

# F-040

Target Debt

Purpose

Calculate the debt required to achieve a target Health Factor.

Equation

Target Debt

=

(Collateral × Liquidation Threshold)

/

Target HF

Variables

Collateral

USD

Liquidation Threshold

Protocol Parameter

Target HF

User Defined

Example

Collateral

$120,000

LT

80%

Target HF

2.00

Target Debt

$48,000

---

# F-041

Required Debt Repayment

Purpose

Determine how much debt must be repaid.

Equation

Repayment

=

Current Debt

−

Target Debt

Example

Current Debt

$60,000

Target Debt

$48,000

Repayment

$12,000

TypeScript

```ts
repayment =
Math.max(
0,
currentDebt - targetDebt
);
```

---

# F-042

BTC Sale Required

Purpose

Estimate BTC to sell in order to repay debt.

Equation

BTC Sold

=

Repayment

/

BTC Price

Example

Repayment

$12,000

BTC Price

$60,000

BTC Sold

0.20 BTC

---

# F-043

Exit Profit

Purpose

Calculate realized profit after repayment.

Equation

Exit Profit

=

Portfolio Value

−

Debt

−

Initial Investment

Interpretation

Positive

Profit

Negative

Loss

---

# F-044

Capital Preservation Ratio

Purpose

Measure remaining equity after exit.

Equation

Preservation Ratio

=

Remaining Equity

/

Initial Investment

Higher values indicate stronger capital preservation.

---

# F-045

Target Price Exit

Purpose

Determine BTC price where user-defined profit target is reached.

Equation

Solve

Portfolio Value

=

Target Portfolio Value

The engine computes this iteratively.

---

# F-046

Recommended Partial Exit

Purpose

Determine whether a partial repayment improves risk-adjusted returns.

Method

Simulation

Evaluate

0%

10%

20%

30%

40%

50%

75%

100%

Debt repayment scenarios.

Choose the scenario with the highest improvement in Health Factor per dollar repaid.

---

# F-047

Risk Reduction Efficiency

Purpose

Measure Health Factor improvement per repayment dollar.

Equation

Efficiency

=

Δ Health Factor

/

Repayment Amount

Higher values indicate more effective debt reduction.

---

# F-048

Optimal Exit Window

Purpose

Recommend the most favorable exit period.

Inputs

Current HF

BTC Target Price

APR

Time Horizon

User Goal

Method

Multi-scenario simulation.

Outputs

Suggested

Now

30 Days

90 Days

180 Days

Custom

The recommendation always includes an explanation.

---

# F-049

Exit Confidence Score

Purpose

Summarize recommendation quality.

Inputs

Risk

Market Distance

Debt

APR

Simulation Stability

Outputs

0–100

Example

92

High Confidence

63

Moderate Confidence

25

Low Confidence

This score communicates confidence, not certainty.

---

# EXIT DEPENDENCY GRAPH

Portfolio

↓

Debt

↓

Target HF (F-040)

↓

Repayment (F-041)

↓

BTC Sale (F-042)

↓

Risk Reduction (F-047)

↓

Optimal Exit (F-048)

↓

Exit Confidence (F-049)

↓

Dashboard

---

# POSITION TIMELINE (NEW)

Purpose

Visualize how the position evolves over time.

Inputs

Current Portfolio

BTC Price Scenario

APR

Debt

Health Factor

Simulation Horizon

Outputs

Projected Debt

Projected Health Factor

Projected Liquidation Price

Projected Interest Paid

Projected Net Worth

Projected Risk Category

This timeline powers the interactive dashboard and scenario comparison views.

---

# IMPLEMENTATION NOTES

The Exit Engine should support

Immediate exits

Partial exits

Gradual deleveraging

Target Health Factor exits

Target BTC price exits

Time-based exits

Future versions may include tax-aware exit planning and multi-protocol optimization.

---

# UNIT TEST EXAMPLES

Scenario A

Current Debt

$60,000

Target Debt

$48,000

Expected Repayment

$12,000

---

Scenario B

Repayment

$12,000

BTC

$60,000

Expected BTC Sold

0.20 BTC

---

Scenario C

Target HF

2.00

Simulation

Recommended Partial Exit

Expected

Health Factor increases while minimizing BTC sold.

---

# ACCEPTANCE CRITERIA

✓ Exit recommendations are deterministic.

✓ Repayment calculations are correct.

✓ BTC sale estimates are accurate.

✓ Target Health Factor exits are supported.

✓ Position Timeline is integrated.

✓ Confidence Score is generated.

✓ Formula IDs F-040 through F-049 are documented.

---

END OF PAGE 6

NEXT

Page 7

Scenario Simulation & Forecast Engine

# 02_FORMULAS

Project

ProfitPilot

Page

7 of 10

Title

Scenario Simulation & Forecast Engine

Version

1.0

Dependencies

F-001 → F-049

---

# PURPOSE

The Forecast Engine evaluates how a leveraged portfolio behaves under changing market conditions.

Unlike static portfolio calculations, scenario simulation projects future portfolio states across multiple possible outcomes.

The objective is not to predict the future.

The objective is to prepare the user for it.

---

# SIMULATION PHILOSOPHY

ProfitPilot never predicts prices.

Instead, it answers:

If this happens...

↓

What happens to my portfolio?

Every scenario is deterministic and based on explicit assumptions.

---

# SCENARIO TYPES

Version 1.0 supports

BTC Price Change

Borrow APR Change

Time Progression

Manual Debt Repayment

Additional Collateral

Loop Reduction

Future versions

Volatility Models

Monte Carlo Simulation

Historical Replay

Multi-Asset Portfolios

---

# F-050

Price Change Simulation

Purpose

Calculate portfolio state after a BTC price movement.

Inputs

Current BTC Holdings

Current Debt

New BTC Price

Outputs

Portfolio Value

Collateral Value

Net Worth

Health Factor

Liquidation Price

Example

BTC

2.5

Old Price

$60,000

New Price

$90,000

Portfolio

$225,000

Debt

Unchanged

Health Factor

Recalculated

---

# F-051

Percentage Price Movement

Purpose

Apply market movement.

Equation

New Price

=

Current Price

×

(1 + Change%)

Example

BTC

$60,000

Increase

25%

New Price

$75,000

Decrease

20%

New Price

$48,000

---

# F-052

Portfolio Projection

Purpose

Project complete portfolio metrics.

Outputs

Portfolio Value

Debt

Net Worth

Exposure

Leverage

Health Factor

Risk Category

Interest Paid

Liquidation Price

Every scenario recalculates every metric.

---

# F-053

Scenario Difference

Purpose

Compare two scenarios.

Equation

Difference

=

Scenario B − Scenario A

Example

Net Worth

Scenario A

$180,000

Scenario B

$210,000

Difference

+$30,000

---

# F-054

Best Case Scenario

Purpose

Identify the highest portfolio value.

Method

Evaluate every simulation.

Return

Maximum Net Worth

Associated Risk

Associated Health Factor

Required Time

---

# F-055

Worst Case Scenario

Purpose

Identify highest risk outcome.

Method

Minimum Health Factor

Maximum Debt

Lowest Net Worth

Highest Liquidation Probability

---

# F-056

Break-Even Scenario

Purpose

Find BTC price where

Net Profit

=

0

Method

Iterative Solver

Outputs

Required BTC Price

Required Time

Health Factor

Debt

---

# F-057

Target Achievement Simulation

Purpose

Estimate when user goals are achieved.

Supported Goals

BTC Price

Portfolio Value

Net Worth

Health Factor

Profit

Debt Reduction

Method

Evaluate every scenario until target is reached.

---

# F-058

Scenario Ranking Score

Purpose

Rank every simulated future.

Inputs

Expected Return

Health Factor

Debt

Interest Cost

Risk Score

Target Completion

Output

0–100

Higher score

More attractive scenario.

---

# F-059

Simulation Summary

Purpose

Generate final recommendation.

Outputs

Best Scenario

Safest Scenario

Highest Return

Lowest Cost

Fastest Target

Recommended Action

Every simulation ends with an explanation.

---

# SCENARIO MATRIX

Each simulation recalculates

↓

BTC Price

↓

Portfolio Value

↓

Collateral

↓

Debt

↓

Interest

↓

Net Worth

↓

Leverage

↓

Health Factor

↓

Liquidation Price

↓

Risk Category

↓

Recommendation

No metric is reused from previous simulations.

Each scenario is independent.

---

# POSITION TIMELINE ENGINE

Every scenario generates a timeline.

Example

Today

↓

30 Days

↓

90 Days

↓

180 Days

↓

365 Days

Each point contains

Portfolio Value

Debt

Interest Paid

Health Factor

Risk

Liquidation Price

Recommendation

This powers the interactive dashboard.

---

# IMPLEMENTATION NOTES

The simulation engine must be deterministic.

Running the same inputs twice must always produce identical results.

No randomness is introduced in Version 1.0.

Randomized simulations are reserved for future Monte Carlo functionality.

---

# UNIT TEST EXAMPLES

Scenario A

BTC

$60k → $90k

Expected

Portfolio increases

Health Factor improves

Debt unchanged

---

Scenario B

BTC

$60k → $45k

Expected

Portfolio decreases

Health Factor declines

Liquidation Price approaches

---

Scenario C

APR

5%

↓

8%

Expected

Debt growth accelerates

Time to Danger decreases

---

# ACCEPTANCE CRITERIA

✓ All scenarios are deterministic.

✓ Portfolio metrics recalculate correctly.

✓ Scenario comparison is supported.

✓ Goal simulations function correctly.

✓ Timeline generation is available.

✓ Formula IDs F-050 through F-059 are documented.

---

END OF PAGE 7

NEXT

Page 8

Recommendation Engine & Decision Scoring

# 02_FORMULAS

Project

ProfitPilot

Page

8 of 10

Title

Recommendation Engine

Version

1.0

Dependencies

F-001 → F-059

---

# PURPOSE

The Recommendation Engine converts portfolio calculations into clear, actionable guidance.

Its objective is not to make decisions for the user.

Its objective is to explain the current situation and suggest reasonable actions based on predefined rules.

Recommendations are deterministic and fully explainable.

---

# DECISION PRIORITY

Recommendations are generated in the following order.

1. Prevent Liquidation

2. Maintain Target Health Factor

3. Reduce Interest Costs

4. Improve Capital Efficiency

5. Achieve User Goals

Safety always has higher priority than profitability.

---

# F-060

Health Factor Recommendation

Purpose

Recommend an action based on the current Health Factor.

Rules

HF ≥ 2.00

Recommendation

Excellent.

No action required.

HF 1.80 – 2.00

Healthy.

Consider monitoring weekly.

HF 1.60 – 1.80

Good.

Avoid additional borrowing.

HF 1.40 – 1.60

Caution.

Consider partial repayment.

HF 1.20 – 1.40

High Risk.

Reduce debt or add collateral.

HF < 1.20

Critical.

Immediate action recommended.

---

# F-061

Borrow Recommendation

Purpose

Determine whether additional borrowing is reasonable.

Conditions

Target HF remains above user minimum.

Available Borrow > 0

Debt Ratio below target.

If all conditions are satisfied

Recommendation

Borrowing is acceptable.

Otherwise

Do not recommend additional borrowing.

---

# F-062

Repayment Recommendation

Purpose

Estimate the minimum repayment required.

Equation

Required Repayment

=

Current Debt

−

Target Debt

Reference

F-040

Output

USD

Estimated BTC Required

Expected Health Factor

---

# F-063

Additional Collateral Recommendation

Purpose

Estimate collateral required to reach target Health Factor.

Output

Required USD

Equivalent BTC

Expected Health Factor

---

# F-064

Loop Recommendation

Purpose

Determine whether another leverage loop is appropriate.

Conditions

Health Factor remains above target.

Borrow Capacity available.

Interest Cost acceptable.

Recommendation

Loop One More Time

or

Stop Looping

The recommendation should always include the expected Health Factor after the proposed loop.

---

# F-065

Interest Warning

Purpose

Warn when borrowing costs become excessive.

Rule

Annual Interest

>

Expected Annual Portfolio Growth

↓

Display Warning

"Interest costs may outweigh expected returns."

---

# F-066

Profit Target Recommendation

Purpose

Notify when portfolio reaches the user's target.

Inputs

Target BTC Price

Target Portfolio Value

Target Profit

Output

Target Reached

or

Remaining Distance

---

# F-067

Simple Portfolio Score

Purpose

Provide an easy-to-understand summary.

Components

Health Factor

40%

Debt Ratio

20%

Interest Cost

15%

Leverage

15%

Portfolio Growth

10%

Output

0–100

Example

92

Excellent

76

Good

58

Average

34

High Risk

---

# F-068

Primary Recommendation

Purpose

Display one clear action.

Priority

1.

Prevent liquidation

2.

Increase Health Factor

3.

Reduce Interest

4.

Continue Holding

5.

Take Partial Profit

Only one primary recommendation is shown.

---

# F-069

Recommendation Summary

Purpose

Generate the dashboard summary.

Example

Current Position

Healthy

Health Factor

1.82

Leverage

2.35×

Estimated Annual Interest

$2,740

Recommendation

Hold Position

No immediate action required.

Monitor Health Factor monthly.

---

# IMPLEMENTATION NOTES

Recommendations are rule-based.

No machine learning.

No prediction.

No hidden scoring.

Every recommendation must be explainable.

---

# UNIT TEST EXAMPLES

Scenario A

HF

2.15

Expected

No Action Required

---

Scenario B

HF

1.35

Expected

Reduce Debt

---

Scenario C

Interest

$5,000/year

Expected

Interest Warning

---

# ACCEPTANCE CRITERIA

✓ Recommendations are deterministic.

✓ Every recommendation includes a reason.

✓ Only one primary recommendation is displayed.

✓ Target Health Factor is respected.

✓ Formula IDs F-060 through F-069 are documented.

---

END OF PAGE 8

NEXT

Page 9

Performance Metrics & Analytics

# 02_FORMULAS

Project

ProfitPilot

Page

9 of 10

Title

Performance Metrics & Analytics

Version

1.0

Dependencies

F-001 → F-069

---

# PURPOSE

This chapter defines the key performance indicators (KPIs) displayed throughout the application.

These metrics summarize portfolio health, leverage, borrowing costs, and investment performance using previously defined formulas.

No new financial calculations are introduced in this chapter.

---

# PERFORMANCE PHILOSOPHY

ProfitPilot focuses on meaningful metrics.

Every displayed metric should answer one of the following questions.

How much do I own?

How much do I owe?

How risky is my position?

How much is leverage helping?

How much is leverage costing?

How close am I to my goal?

---

# M-001

Current Portfolio Value

Formula

F-001

Display

USD

Example

$152,340

---

# M-002

Net Worth

Formula

F-004

Display

USD

Example

$98,750

---

# M-003

Total BTC Holdings

Formula

F-010

Display

BTC

Example

2.73451842 BTC

Display Precision

8 decimals

---

# M-004

Current Debt

Formula

F-003

Display

USD

Example

$54,200

---

# M-005

Effective Leverage

Formula

F-011

Display

Multiplier

Example

2.41×

Recommended Colors

1.0–2.0

Green

2.0–2.8

Yellow

Above 2.8

Orange

---

# M-006

Health Factor

Formula

F-022

Display

Number

Example

1.84

Recommended Colors

HF > 2.0

Green

HF 1.6–2.0

Yellow

HF 1.3–1.6

Orange

HF < 1.3

Red

---

# M-007

Liquidation Price

Formula

F-024

Display

USD

Example

$31,250

Also Display

Distance from Current Price

Example

Current BTC

$60,000

Liquidation

$31,250

Safety Margin

47.9%

---

# M-008

Interest Cost

Formula

F-030

F-031

F-032

Display

Daily

Monthly

Yearly

Example

Daily

$8.21

Monthly

$249

Yearly

$2,995

---

# M-009

Position Return

Formula

F-008

Display

%

Example

+112%

Also Display

Dollar Gain

+$58,000

---

# M-010

Portfolio Score

Formula

F-067

Display

0–100

Example

88

Interpretation

90+

Excellent

75–89

Healthy

60–74

Acceptable

40–59

Needs Attention

Below 40

High Risk

---

# DASHBOARD SUMMARY

The main dashboard should display

Portfolio Value

Net Worth

BTC Holdings

Debt

Effective Leverage

Health Factor

Liquidation Price

Interest Cost

Portfolio Return

Portfolio Score

Primary Recommendation

These metrics should be visible without scrolling.

---

# KPI REFRESH STRATEGY

Price Data

Refresh according to selected provider or manual refresh.

Portfolio Metrics

Recalculate whenever

BTC Price changes

Debt changes

Collateral changes

Interest accrues

Simulation parameters change

All calculations should complete in under 100 milliseconds on a typical desktop.

---

# ANALYTICS HISTORY

Version 1.0

Store

Portfolio snapshots

Snapshot Frequency

User initiated

Future Versions

Daily automatic snapshots

Historical charts

Performance trends

Risk history

Exit history

---

# EXPORT METRICS

Users should be able to export

Portfolio Summary

Scenario Results

Interest Summary

Exit Plan

CSV

JSON

PDF (Future Version)

---

# IMPLEMENTATION NOTES

All dashboard metrics derive from existing formulas.

No duplicate calculations should exist.

The Dashboard reads data from the Portfolio Engine.

The Portfolio Engine is the single source of truth.

---

# UNIT TEST EXAMPLES

Portfolio Value

Matches F-001

Net Worth

Matches F-004

Health Factor

Matches F-022

Portfolio Score

Matches F-067

Liquidation Price

Matches F-024

Interest

Matches F-030–032

---

# ACCEPTANCE CRITERIA

✓ Dashboard metrics reference existing formulas.

✓ No duplicate financial calculations exist.

✓ Display formatting is standardized.

✓ KPI refresh is deterministic.

✓ Export formats are defined.

✓ Metric IDs M-001 through M-010 are documented.

---

END OF PAGE 9

NEXT

Page 10

Formula Validation, Test Cases & Reference Scenarios

# 02_FORMULAS

Project

ProfitPilot

Page

10 of 10

Title

Formula Validation, Reference Portfolio & Test Cases

Version

1.0

Dependencies

F-001 → F-069

---

# PURPOSE

This chapter defines how every mathematical calculation within ProfitPilot is verified.

Its purpose is to ensure mathematical correctness, reproducibility, and consistency across all future versions of the application.

Every implementation must produce identical results when provided with identical inputs.

---

# VALIDATION PRINCIPLES

Every formula must be

Correct

↓

Deterministic

↓

Repeatable

↓

Independently Testable

↓

Documented

Mathematical correctness always has higher priority than performance.

---

# GOLDEN REFERENCE PORTFOLIO

The following portfolio serves as the official validation dataset for Version 1.0.

Initial Capital

$100,000

BTC Price

$30,000

Initial BTC Purchased

3.33333333 BTC

Maximum LTV

70%

Liquidation Threshold

80%

Borrow APR

5%

Target Health Factor

1.80

Loop Strategy

Automatic

Stop at Target HF

This scenario should be used in

Unit Tests

Integration Tests

Regression Tests

Documentation Examples

Demo Mode

---

# REFERENCE OUTPUTS

Every implementation should produce values consistent with this dataset.

Examples

Portfolio Value

Calculated using F-001

Debt

Calculated using F-003

Net Worth

Calculated using F-004

Effective Leverage

Calculated using F-011

Health Factor

Calculated using F-022

Liquidation Price

Calculated using F-024

Annual Interest

Calculated using F-032

Portfolio Score

Calculated using F-067

Minor floating-point differences are acceptable within the defined tolerance.

---

# ACCEPTABLE ERROR

Currency

± $0.01

BTC

± 0.00000001 BTC

Percentages

± 0.01%

Health Factor

± 0.001

Floating Point Drift

Machine Precision

Any deviation larger than these limits should be treated as a failed test.

---

# TEST CATEGORIES

Formula Tests

Verify each formula independently.

Integration Tests

Verify calculations across multiple formulas.

Regression Tests

Ensure updates do not change previous results.

Scenario Tests

Validate complete portfolio simulations.

Performance Tests

Ensure calculations remain within target execution times.

---

# EDGE CASES

Every formula must correctly handle

Zero portfolio value

Zero debt

Zero collateral

Maximum borrowing

Very high BTC prices

Very low BTC prices

Invalid inputs

Negative values

Division by zero

Null values

Unexpected API responses

Invalid inputs should return descriptive errors instead of incorrect calculations.

---

# REGRESSION TESTING

Every release should verify

Portfolio calculations

Borrow calculations

Interest calculations

Health Factor calculations

Liquidation calculations

Exit calculations

Recommendation calculations

Simulation calculations

No existing calculation should change without an intentional formula update.

---

# PERFORMANCE TARGETS

Single Formula

< 1 millisecond

Portfolio Calculation

< 50 milliseconds

Scenario Simulation

< 100 milliseconds

Dashboard Refresh

< 100 milliseconds

These targets are intended for a modern desktop browser.

---

# DOCUMENTATION REQUIREMENTS

Every implemented formula must reference

Formula ID

Source Document

Related Formulas

Unit Tests

Source Code

Documentation and implementation must remain synchronized.

---

# VERSION COMPATIBILITY

Future versions may introduce

Additional Assets

Additional Protocols

Variable Interest Rates

Compounding Models

Advanced Simulations

New formulas must not alter the behavior of existing Formula IDs without version documentation.

---

# IMPLEMENTATION CHECKLIST

Before a release

✓ All Formula IDs implemented

✓ Unit tests passing

✓ Integration tests passing

✓ Golden Reference Portfolio verified

✓ Dashboard values verified

✓ No undocumented calculations

✓ Documentation updated

---

# FORMULA INDEX

Portfolio Metrics

F-001 → F-009

Leverage & Loop Mathematics

F-010 → F-019

Aave Risk Mathematics

F-020 → F-029

Interest & Position Decay

F-030 → F-039

Exit Strategy

F-040 → F-049

Scenario Simulation

F-050 → F-059

Recommendation Engine

F-060 → F-069

Performance Metrics

M-001 → M-010

---

# DOCUMENT COMPLETION

Document

02_FORMULAS

Version

1.0

Pages

10

Formula IDs

69

Dashboard Metrics

10

Validation Dataset

1

Status

COMPLETE

---

# FINAL ACCEPTANCE CRITERIA

The Formula Specification is complete when

✓ Every financial calculation is documented.

✓ Every Formula ID is unique.

✓ Every formula includes purpose and implementation guidance.

✓ Every formula has validation examples.

✓ Dashboard metrics reference existing formulas.

✓ A Golden Reference Portfolio exists.

✓ Error tolerances are defined.

✓ Test strategy is documented.

✓ Formula Specification is approved for implementation.

---

END OF DOCUMENT

Document

02_FORMULAS

Status

COMPLETE

Version

1.0

Project

ProfitPilot

Ready for Development
