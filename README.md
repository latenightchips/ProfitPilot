# ProfitPilot

Version: 0.1.0

Status: Planning

Document Type: AI Project Specification

Primary Audience: AI Coding Agents (ChatGPT, Codex, Claude Code, Cursor, Lovable, Replit Agent)

Human Audience: Project Owner

---

# PROJECT PURPOSE

Build a personal web application named ProfitPilot.

The application helps a single investor manage leveraged Bitcoin positions using the Aave lending protocol.

The application is NOT an automated trading bot.

The application does NOT execute blockchain transactions.

The application is a decision-support tool.

Every recommendation must be explainable using documented financial formulas.

---

# PRIMARY GOAL

Answer these four questions immediately.

1.

Am I safe?

2.

Can I borrow more?

3.

Should I repay debt?

4.

What happens if Bitcoin moves to another price?

Everything inside the application exists to answer these questions.

---

# PRODUCT PHILOSOPHY

When generating code, always prioritize:

1.

Correctness

Never estimate financial values.

Always calculate using documented formulas.

Never invent values.

---

2.

Transparency

Every displayed metric must have a documented formula.

The user must understand where every number comes from.

---

3.

Safety

If uncertain between two recommendations,

always choose the safer recommendation.

Never recommend aggressive leverage without explicitly explaining the increase in liquidation risk.

---

4.

Simplicity

The interface should be understandable in less than 10 seconds.

Avoid unnecessary controls.

Avoid information overload.

Every screen must answer one clear question.

---

5.

Performance

All calculations must update instantly.

Target:

<100ms calculation time.

No page reloads.

---

# TARGET USER

Exactly one user.

Profile

• Bitcoin investor

• Uses Aave V3

• Borrows USDC or GHO

• Uses BTC as collateral

• Creates leverage loops

• Holds positions for months

• Wants conservative risk management

Do not optimize for traders.

Do not optimize for institutions.

Optimize for this single workflow.

---

# APPLICATION SCOPE

Version 0.1 includes only planning.

The application will NOT connect to a wallet.

The application will NOT execute transactions.

The application will NOT sign blockchain messages.

Every input is entered manually.

Future versions may connect to live APIs.

---

# MVP FEATURES

The AI should build these modules.

Dashboard

Position Simulator

Loop Simulator

Risk Engine

Interest Calculator

Exit Planner

Recommendation Engine

Settings

Each module should remain independent.

Avoid tightly coupling business logic to UI components.

---

# DESIGN PRINCIPLES

Use

Next.js

React

TypeScript

TailwindCSS

Component-first architecture.

Dark theme.

Responsive layout.

Desktop first.

Mobile compatible.

No Bootstrap.

No Material UI.

Prefer custom reusable components.

---

# PROJECT STRUCTURE

The AI should organize the project using the following structure.

ProfitPilot/

README.md

docs/

components/

pages/

hooks/

lib/

types/

utils/

styles/

public/

Each folder must have one responsibility.

Never place business calculations inside UI components.

All calculations belong inside

/lib

---

# CODING PRINCIPLES

Every calculation must exist only once.

Never duplicate formulas.

Avoid magic numbers.

Create constants.

Write readable code.

Prefer descriptive variable names.

Avoid abbreviations except:

HF

LTV

APR

BTC

USDC

GHO

Every function should have one responsibility.

---

# SUCCESS CRITERIA

Version 0.1 is successful if the application allows the user to determine within 10 seconds:

Current Health Factor

Current LTV

Liquidation Price

Borrow Capacity

Interest Cost

Portfolio Value

Recommended Action

without opening any additional screens.

This requirement has priority over adding new features.

---

End of README.md

Page 1 of 2

# README.md

Page 2 of 2

---

# MATHEMATICAL AUTHORITY

This project is a financial application.

Financial correctness has higher priority than UI.

If there is a conflict between appearance and mathematical accuracy,

mathematical accuracy always wins.

Never estimate.

Never approximate unless explicitly requested.

Every calculation must be deterministic.

---

# SINGLE SOURCE OF TRUTH

Every financial formula must exist in exactly one location.

Preferred structure

/lib/math/

Examples

healthFactor.ts

ltv.ts

liquidation.ts

interest.ts

borrowCapacity.ts

loopSimulation.ts

Never duplicate formulas inside:

components/

pages/

hooks/

UI

If multiple pages require the same calculation,

import the function.

---

# STATE MANAGEMENT

There should only be one portfolio state.

Example

Portfolio

↓

Collateral

↓

Debt

↓

Metrics

↓

Recommendation

Never create multiple copies of portfolio data.

The Dashboard,

Simulator,

Recommendation Engine,

and Exit Planner

must all read from the same state.

---

# CALCULATION ORDER

Always calculate values in the following order.

1

Inputs

↓

2

Collateral Value

↓

3

Debt

↓

4

Loan-to-Value

↓

5

Health Factor

↓

6

Liquidation Price

↓

7

Borrow Capacity

↓

8

Interest

↓

9

Portfolio Value

↓

10

Recommendation

Later calculations may depend on previous values.

Never calculate Recommendation before Risk Metrics.

---

# RECOMMENDATION ENGINE

The Recommendation Engine is advisory only.

It never executes actions.

Possible outputs

BORROW

HOLD

REPAY

REDUCE RISK

AVOID LEVERAGE

Every recommendation must include

Reason

Risk Level

Expected Result

Example

Recommendation

HOLD

Reason

Health Factor is already close to target.

Borrowing additional funds would increase liquidation risk.

Risk

Low

---

# ERROR HANDLING

The application must never crash because of invalid inputs.

Examples

Debt = 0

BTC = 0

APR < 0

Negative BTC

Division by zero

Missing values

NaN

Infinity

Always display meaningful validation messages.

Never display JavaScript errors to the user.

---

# USER EXPERIENCE RULES

The application should feel calm.

Avoid flashing colors.

Avoid unnecessary animations.

Do not overload the dashboard.

The user should understand the entire portfolio within 15 seconds.

Every metric should include

Name

Value

Short explanation

Optional tooltip

---

# COLOR SYSTEM

Green

Safe

Yellow

Monitor

Orange

Elevated Risk

Red

Danger

Never use color alone.

Always include text labels.

Example

🟢 Safe

🟡 Monitor

🟠 Elevated Risk

🔴 Danger

---

# FILE ORGANIZATION

Preferred project structure

Profitilot

README.md

docs/

components/

Dashboard/

Cards/

Charts/

Forms/

Simulator/

Recommendation/

layout/

hooks/

lib/

math/

risk/

simulation/

recommendation/

utils/

types/

constants/

styles/

public/

tests/

Never place business logic inside components.

Components should display data.

Libraries should calculate data.

---

# TESTING REQUIREMENTS

Every mathematical function must have tests.

Minimum coverage

Health Factor

LTV

Interest

Liquidation Price

Borrow Capacity

Loop Engine

Recommendation Engine

Before release,

verify calculations using known manual examples.

---

# VERSIONING

Version 0.1

Manual Inputs

Dashboard

Simulator

Loop Engine

Recommendation Engine

Version 0.2

Charts

Historical Portfolio

Multiple Simulations

Version 0.3

Wallet Connection

Live BTC Price

Live Aave Parameters

Version 0.4

AI Assistant

Scenario Builder

Stress Testing

Monte Carlo

Version 1.0

Production Ready

---

# DEVELOPMENT RULES FOR AI

When generating code,

always follow this order.

1

Create folder structure.

↓

2

Create TypeScript models.

↓

3

Implement financial formulas.

↓

4

Write unit tests.

↓

5

Build reusable components.

↓

6

Assemble pages.

↓

7

Connect state management.

↓

8

Add charts.

↓

9

Add recommendations.

↓

10

Refactor.

Never skip directly to UI.

The mathematical engine is the foundation of the application.

---

# PROJECT DEFINITION OF DONE

The MVP is complete when the application can:

✓ Display a complete portfolio dashboard

✓ Calculate Health Factor

✓ Calculate Loan-to-Value

✓ Calculate Liquidation Price

✓ Estimate borrowing interest

✓ Simulate leverage loops

✓ Display portfolio value at different BTC prices

✓ Generate recommendations

✓ Suggest an exit strategy

✓ Pass all mathematical tests

without requiring wallet integration.

---

# FINAL AI INSTRUCTION

You are not building a cryptocurrency dashboard.

You are building a financial decision-support system.

Every design decision should improve one of the following:

• Accuracy

• Safety

• Transparency

• Simplicity

If a proposed feature does not improve at least one of these objectives,

it should not be included in Version 0.1.

---

END OF README.md

Version 0.1

Ready for development.
