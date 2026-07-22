# 06_TASKS

Project

ProfitPilot

Page

1 of 10

Title

Project Roadmap & Development Strategy

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

05_AI_PROMPTS.md

---

# PURPOSE

This document defines the implementation roadmap for ProfitPilot.

Unlike the Product Requirements Document or Build Guide, this document focuses on execution.

Every task should produce measurable progress toward a working Version 1.

Tasks should be

Small

Independent

Testable

Documented

Prioritized

---

# DEVELOPMENT PHILOSOPHY

ProfitPilot should always remain in a working state.

Every completed milestone should produce a usable application.

Avoid long periods where the application is broken or incomplete.

Prefer incremental delivery.

---

# VERSION 1 ROADMAP

The project is divided into ten milestones.

M1

Project Foundation

↓

M2

Formula Engine

↓

M3

Core Services

↓

M4

Portfolio Management

↓

M5

Dashboard

↓

M6

Simulation Workspace

↓

M7

Strategy Tools

↓

M8

Persistence & Cloud

↓

M9

Polish & Testing

↓

M10

Production Release

Each milestone builds upon the previous one.

---

# MILESTONE STRUCTURE

Every milestone contains

Objective

Tasks

Dependencies

Deliverables

Acceptance Criteria

Definition of Done

---

# TASK STRUCTURE

Every implementation task follows the same format.

Task ID

Title

Description

Priority

Estimated Effort

Dependencies

Files Affected

Testing

Definition of Done

This structure makes tasks easy to assign, track, and review.

---

# PRIORITY LEVELS

P0

Critical

Required for Version 1

P1

High

Core functionality

P2

Medium

Improves usability

P3

Low

Future enhancement

Priorities should be reviewed before every development session.

---

# EFFORT ESTIMATES

XS

Less than 1 hour

S

1–2 hours

M

2–4 hours

L

Half day

XL

Multiple sessions

Large tasks should be broken into smaller tasks whenever possible.

---

# TASK STATUS

Every task should have one status.

Not Started

In Progress

Blocked

Testing

Complete

Cancelled

Only one status may be active at a time.

---

# DEPENDENCY RULES

A task should depend only on completed tasks.

Avoid circular dependencies.

When possible, keep milestones loosely coupled.

Independent tasks may be completed in parallel.

---

# DEFINITION OF DONE

A task is complete when

✓ Requirements implemented

✓ Documentation followed

✓ Tests pass

✓ TypeScript passes

✓ Lint passes

✓ Code reviewed

✓ No duplicated logic

✓ Build succeeds

A completed task should not require additional implementation before it is usable.

---

# VERSION 1 SUCCESS CRITERIA

Version 1 is complete when

All P0 tasks are complete.

All documented features are implemented.

The Formula Engine passes all tests.

The application builds successfully.

Documentation matches implementation.

No critical defects remain.

The application is suitable for daily personal use.

---

# MILESTONE OVERVIEW

| Milestone | Focus | Goal |
|-----------|-------|------|
| M1 | Foundation | Create the project infrastructure |
| M2 | Formula Engine | Implement all financial calculations |
| M3 | Core Services | Connect business logic to the Engine |
| M4 | Portfolio Management | Build portfolio creation and editing |
| M5 | Dashboard | Display portfolio insights |
| M6 | Simulation Workspace | Interactive scenario analysis |
| M7 | Strategy Tools | Loop Builder, Exit Planner, Recommendations |
| M8 | Persistence & Cloud | Storage, authentication, synchronization |
| M9 | Polish & Testing | UX improvements, optimization, QA |
| M10 | Production Release | Release candidate and Version 1 |

---

# IMPLEMENTATION ORDER

The recommended order is

Foundation

↓

Engine

↓

Services

↓

Portfolio

↓

Dashboard

↓

Simulation

↓

Strategies

↓

Persistence

↓

Testing

↓

Release

This minimizes rework and allows every layer to build upon stable foundations.

---

# PROJECT PRINCIPLES

During implementation

Always prioritize correctness over speed.

Reuse existing code whenever possible.

Implement one task at a time.

Keep tasks small.

Test every feature.

Update documentation when behavior changes.

Finish work before starting new work.

---

# ACCEPTANCE CRITERIA

✓ Roadmap defined.

✓ Milestone structure established.

✓ Task format standardized.

✓ Priorities documented.

✓ Effort estimates defined.

✓ Task lifecycle documented.

✓ Version 1 roadmap completed.

---

END OF PAGE 1

NEXT

Page 2

Milestone 1 — Project Foundation

# 06_TASKS

Project

ProfitPilot

Page

2 of 10

Title

Milestone 1 — Project Foundation

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

05_AI_PROMPTS.md

---

# MILESTONE OBJECTIVE

Establish the project foundation.

At the end of this milestone, the repository should compile successfully and provide a clean architecture ready for feature development.

No financial functionality is implemented during this milestone.

---

# DELIVERABLES

✓ Next.js project configured

✓ TypeScript configured

✓ Tailwind CSS configured

✓ shadcn/ui installed

✓ Repository structure created

✓ Core dependencies installed

✓ ESLint configured

✓ Prettier configured

✓ Testing framework configured

✓ Initial deployment succeeds

---

# TASK M1-001

Title

Create Next.js Project

Priority

P0

Effort

XS

Description

Initialize the application using the latest stable version of Next.js with the App Router and TypeScript enabled.

Deliverables

- Project created
- Development server starts
- Production build succeeds

Definition of Done

Application starts with no errors.

---

# TASK M1-002

Title

Install Core Dependencies

Priority

P0

Effort

S

Description

Install and configure the core project libraries.

Required packages

- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Zustand
- React Hook Form
- Zod
- Decimal.js
- Recharts
- TanStack Table
- Lucide React
- Vitest
- Playwright
- Supabase Client
- Sentry SDK

Definition of Done

All packages install successfully and the project builds.

---

# TASK M1-003

Title

Create Repository Structure

Priority

P0

Effort

S

Description

Create the directory structure defined in the Build Guide.

Directories include

app/

components/

features/

engine/

services/

stores/

hooks/

types/

utils/

constants/

providers/

styles/

tests/

supabase/

docs/

Definition of Done

Repository structure matches the documented architecture.

---

# TASK M1-004

Title

Configure Code Quality

Priority

P0

Effort

S

Description

Configure development tooling.

Tasks

- ESLint
- Prettier
- TypeScript strict mode
- Path aliases
- Import ordering
- Format-on-save

Definition of Done

Lint and formatting run successfully.

---

# TASK M1-005

Title

Configure Testing

Priority

P0

Effort

M

Description

Set up the testing environment.

Include

Vitest

Playwright

Testing utilities

Coverage reporting

Example test

Definition of Done

Both unit and end-to-end tests execute successfully.

---

# TASK M1-006

Title

Create Application Layout

Priority

P1

Effort

S

Description

Implement the root application layout.

Include

Application shell

Navigation placeholder

Header

Responsive layout

Theme support

Placeholder pages

No business logic.

Definition of Done

The application renders using the shared layout.

---

# TASK M1-007

Title

Configure Environment

Priority

P1

Effort

XS

Description

Create the environment configuration.

Include

.env.example

Environment validation

Development configuration

Production configuration

Definition of Done

Missing environment variables are reported clearly.

---

# TASK M1-008

Title

Configure CI Pipeline

Priority

P1

Effort

M

Description

Create a continuous integration workflow.

Pipeline

Install

↓

Lint

↓

Type Check

↓

Tests

↓

Build

Definition of Done

Every pull request executes the pipeline automatically.

---

# TASK M1-009

Title

Deploy Initial Application

Priority

P1

Effort

XS

Description

Deploy the empty application.

Platform

Vercel

Verify

Production build

HTTPS

Environment variables

Deployment status

Definition of Done

The application is publicly accessible.

---

# TASK M1-010

Title

Create Developer Documentation

Priority

P2

Effort

S

Description

Add repository onboarding documentation.

Include

Setup instructions

Development commands

Testing commands

Project structure

Contribution workflow

Definition of Done

A new developer can run the project using the documentation alone.

---

# MILESTONE ACCEPTANCE CRITERIA

✓ Repository structure completed.

✓ Core dependencies installed.

✓ Testing configured.

✓ Linting configured.

✓ CI pipeline operational.

✓ Initial deployment successful.

✓ Documentation updated.

✓ Development environment reproducible.

---

# MILESTONE DEFINITION OF DONE

Milestone 1 is complete when

The repository builds successfully.

The application deploys successfully.

The development workflow is operational.

Every future feature can be implemented without modifying the project foundation.

---

END OF PAGE 2

NEXT

Page 3

Milestone 2 — Formula Engine

# 06_TASKS

Project

ProfitPilot

Page

3 of 10

Title

Milestone 2 — Formula Engine

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

04_BUILD_GUIDE.md

Milestone 1

---

# MILESTONE OBJECTIVE

Implement the complete Formula Engine as the deterministic financial core of ProfitPilot.

At the end of this milestone, all Version 1 calculations should be available through tested, framework-independent TypeScript modules.

The Engine must not depend on

React

Next.js

Supabase

Browser APIs

External providers

UI formatting

Persistence

Every calculation must follow the definitions in `02_FORMULAS.md`.

---

# DELIVERABLES

✓ Engine directory implemented

✓ Shared financial types created

✓ Decimal arithmetic configured

✓ Standard result and error models created

✓ Portfolio calculations implemented

✓ Health Factor calculations implemented

✓ Liquidation calculations implemented

✓ Interest calculations implemented

✓ Loop calculations implemented

✓ Simulation calculations implemented

✓ Exit calculations implemented

✓ Recommendation rules implemented

✓ Formula validation completed

✓ Golden Reference tests passing

---

# IMPLEMENTATION PHASES

Milestone 2 should be completed in this order.

Engine Foundation

↓

Portfolio Mathematics

↓

Risk Mathematics

↓

Interest Mathematics

↓

Loop Mathematics

↓

Simulation

↓

Exit Planning

↓

Recommendations

↓

Verification

Later phases must not duplicate formulas implemented in earlier phases.

---

# TASK M2-001

Title

Create Formula Engine Foundation

Priority

P0

Effort

M

Dependencies

M1-003

Description

Create the Engine module structure defined in the Build Guide.

Include

```text
engine/
├── portfolio/
├── health/
├── liquidation/
├── interest/
├── loop/
├── simulation/
├── exit/
├── recommendation/
├── validation/
├── shared/
└── index.ts
```

Definition of Done

The Engine can be imported through a single public entry point.

No framework dependencies exist inside the Engine.

---

# TASK M2-002

Title

Implement Shared Financial Types

Priority

P0

Effort

M

Dependencies

M2-001

Description

Create the shared domain types required by Engine modules.

Include

Portfolio inputs

Collateral positions

Debt positions

Protocol parameters

Market prices

Simulation inputs

Exit-plan inputs

Recommendation inputs

Formula results

Warnings

Errors

Metadata

Definition of Done

All Engine modules can use shared types without importing application-layer types.

---

# TASK M2-003

Title

Configure Decimal Arithmetic

Priority

P0

Effort

S

Dependencies

M2-001

Description

Configure Decimal.js as the internal arithmetic standard.

Requirements

Avoid native floating-point arithmetic for financial calculations.

Define conversion helpers.

Define supported decimal precision.

Define public-boundary serialization rules.

Definition of Done

Engine calculations use the approved decimal helpers consistently.

---

# TASK M2-004

Title

Create Standard Formula Result Model

Priority

P0

Effort

S

Dependencies

M2-002

Description

Implement the standardized Engine return type.

Include

Value

Formula ID

Warnings

Errors

Assumptions

Engine version

Formula version

Inputs used

Definition of Done

Formula modules return a predictable typed result rather than raw unstructured values.

---

# TASK M2-005

Title

Implement Engine Validation Utilities

Priority

P0

Effort

M

Dependencies

M2-002

M2-004

Description

Create reusable validation functions for financial inputs.

Validate

Finite values

Non-negative values

Positive-only values

Percentages

Prices

Token quantities

Rates

Thresholds

Time periods

Protocol parameters

Definition of Done

Invalid inputs produce standardized errors and never generate silent `NaN` or infinite results.

---

# TASK M2-006

Title

Implement Portfolio Value Calculations

Priority

P0

Effort

M

Dependencies

M2-003

M2-005

Description

Implement documented portfolio valuation Formula IDs.

Include

Collateral value by asset

Total collateral value

Debt value by asset

Total debt value

Net portfolio value

Asset allocation percentages

Debt allocation percentages

Definition of Done

All portfolio valuation formulas have unit and boundary tests.

---

# TASK M2-007

Title

Implement Loan-to-Value Calculations

Priority

P0

Effort

S

Dependencies

M2-006

Description

Implement current and maximum Loan-to-Value calculations.

Include

Current LTV

Maximum borrowing capacity

Remaining borrowing capacity

Weighted maximum LTV

Definition of Done

Calculations support multiple collateral positions and protocol parameters.

---

# TASK M2-008

Title

Implement Leverage Calculations

Priority

P0

Effort

M

Dependencies

M2-006

Description

Implement leverage-related Formula IDs.

Include

Equity

Gross exposure

Leverage ratio

Debt-to-equity ratio

Collateral multiplier

Effective BTC exposure

Definition of Done

Leverage outputs remain internally consistent with portfolio values.

---

# TASK M2-009

Title

Implement Health Factor Calculations

Priority

P0

Effort

M

Dependencies

M2-006

M2-005

Description

Implement Aave-style Health Factor calculations.

Include

Weighted liquidation threshold

Adjusted collateral value

Current Health Factor

Health Factor without debt

Health Factor status classification

Definition of Done

The Engine handles zero-debt portfolios safely and verifies cross-formula consistency.

---

# TASK M2-010

Title

Implement Liquidation Price Calculations

Priority

P0

Effort

L

Dependencies

M2-009

Description

Implement liquidation-related Formula IDs.

Include

Single-collateral liquidation price

Required collateral price for a target Health Factor

Liquidation distance

Price decline to liquidation

Collateral reduction to liquidation

Debt increase to liquidation

Definition of Done

Calculations document assumptions and return warnings when simplified models are used.

---

# TASK M2-011

Title

Implement Target Health Factor Calculations

Priority

P1

Effort

M

Dependencies

M2-009

Description

Calculate portfolio changes required to reach a target Health Factor.

Include

Debt repayment required

Collateral addition required

Collateral withdrawal available

Resulting Health Factor verification

Definition of Done

Every target calculation is verified by recomputing the resulting Health Factor.

---

# TASK M2-012

Title

Implement Simple Interest Calculations

Priority

P0

Effort

S

Dependencies

M2-003

M2-005

Description

Implement documented simple interest formulas.

Include

Annual interest cost

Monthly interest cost

Daily interest cost

Prorated interest cost

Definition of Done

Tests cover zero rates, zero debt, fractional periods, and invalid rates.

---

# TASK M2-013

Title

Implement Compound Interest Calculations

Priority

P0

Effort

M

Dependencies

M2-012

Description

Implement compound debt-growth calculations.

Include

Periodic compounding

Continuous or protocol-defined approximation where documented

Projected debt balance

Accumulated interest

Effective annual rate

Definition of Done

Compounding frequency and time units are explicit and tested.

---

# TASK M2-014

Title

Implement Variable Rate Projection

Priority

P1

Effort

M

Dependencies

M2-013

Description

Implement interest projections using rate scenarios.

Include

Constant-rate scenario

Rate increase scenario

Rate decrease scenario

Custom rate path

Definition of Done

Projection assumptions are returned with each result.

---

# TASK M2-015

Title

Implement Loop Step Mathematics

Priority

P0

Effort

L

Dependencies

M2-006

M2-007

M2-009

Description

Implement one borrow-and-resupply loop step.

Include

Available borrowing amount

Borrowed stablecoin value

BTC purchase quantity

Collateral after resupply

Debt after borrowing

New LTV

New Health Factor

Definition of Done

One-step loop outputs reconcile with portfolio and risk modules.

---

# TASK M2-016

Title

Implement Multi-Step Loop Strategy

Priority

P0

Effort

L

Dependencies

M2-015

Description

Implement repeated loop calculations.

Inputs

Starting portfolio

Target borrow percentage

Maximum number of loops

Minimum Health Factor

Protocol parameters

Fees and slippage assumptions

Outputs

Step-by-step results

Final collateral

Final debt

Final equity

Final leverage

Final Health Factor

Stop reason

Definition of Done

The strategy stops safely when a configured limit is reached.

---

# TASK M2-017

Title

Implement Loop Cost Calculations

Priority

P1

Effort

M

Dependencies

M2-016

M2-013

Description

Calculate the expected costs of a loop strategy.

Include

Borrowing interest

Swap fees

Slippage

Gas estimate

Total implementation cost

Break-even BTC appreciation

Definition of Done

Every cost is itemized and included in final loop results.

---

# TASK M2-018

Title

Implement Loop Safety Validation

Priority

P0

Effort

M

Dependencies

M2-016

Description

Validate proposed loop strategies before returning them as viable.

Check

Minimum Health Factor

Maximum LTV

Maximum loop count

Borrowing capacity

Valid protocol parameters

Excessive cost

Liquidation proximity

Definition of Done

Unsafe strategies return explicit errors or warnings rather than appearing successful.

---

# TASK M2-019

Title

Implement Price Scenario Simulation

Priority

P0

Effort

L

Dependencies

M2-006

M2-009

M2-010

Description

Implement scenario calculations for changes in asset prices.

Include

Collateral value

Debt value

Net equity

LTV

Health Factor

Liquidation distance

Profit or loss

Definition of Done

The same simulation function supports both absolute prices and percentage changes.

---

# TASK M2-020

Title

Implement Interest Scenario Simulation

Priority

P1

Effort

M

Dependencies

M2-014

M2-019

Description

Extend simulations to include projected debt growth.

Include

Time horizon

Rate assumptions

Projected debt

Projected equity

Projected Health Factor

Definition of Done

Price and interest assumptions can be combined in one deterministic scenario.

---

# TASK M2-021

Title

Implement Collateral and Debt Scenarios

Priority

P1

Effort

M

Dependencies

M2-019

Description

Support simulations involving changes to portfolio positions.

Include

Add collateral

Withdraw collateral

Borrow more

Repay debt

Combined actions

Definition of Done

Each simulated action returns both before and after portfolio states.

---

# TASK M2-022

Title

Implement Scenario Comparison

Priority

P1

Effort

M

Dependencies

M2-019

M2-020

M2-021

Description

Create comparison utilities for multiple simulation results.

Compare

Equity

Profit or loss

Health Factor

Liquidation distance

Debt cost

Leverage

Definition of Done

Scenarios can be ranked and displayed without recalculating values in the UI.

---

# TASK M2-023

Title

Implement Exit Position Calculations

Priority

P0

Effort

L

Dependencies

M2-006

M2-009

Description

Implement exit-planning calculations.

Include

Collateral sale required to repay debt

BTC quantity retained

Remaining equity

Exit transaction costs

Full-exit result

Partial-exit result

Definition of Done

Exit outputs reconcile with current portfolio balances.

---

# TASK M2-024

Title

Implement Target Exit Calculations

Priority

P1

Effort

M

Dependencies

M2-023

Description

Calculate exit actions for user-defined targets.

Targets may include

Target BTC price

Target retained BTC

Target debt balance

Target Health Factor

Target cash proceeds

Definition of Done

The Engine reports when a requested target is mathematically infeasible.

---

# TASK M2-025

Title

Implement Recommendation Rule Framework

Priority

P1

Effort

M

Dependencies

M2-009

M2-010

M2-013

Description

Create a deterministic rule framework for portfolio recommendations.

Recommendation categories

Safety

Debt management

Collateral management

Interest cost

Leverage

Exit readiness

Definition of Done

Recommendations are generated from explicit rules rather than opaque AI behavior.

---

# TASK M2-026

Title

Implement Recommendation Explanations

Priority

P1

Effort

M

Dependencies

M2-025

Description

Attach transparent explanations to every recommendation.

Include

Triggering condition

Relevant values

Expected effect

Risk level

Suggested action

Formula references

Definition of Done

Every recommendation can be traced to its input values and decision rule.

---

# TASK M2-027

Title

Implement Engine Invariants

Priority

P0

Effort

M

Dependencies

M2-006 through M2-026

Description

Add automated checks for relationships that must always remain true.

Examples

Net value equals collateral minus debt.

Allocation percentages total approximately 100%.

Target Health Factor results reproduce the target.

Loop results reconcile with step totals.

Full debt repayment produces zero debt.

Definition of Done

Invariant violations fail tests and expose implementation defects.

---

# TASK M2-028

Title

Create Golden Reference Portfolios

Priority

P0

Effort

L

Dependencies

M2-027

Description

Create a verified set of reference portfolios with known outputs.

Reference cases should include

No debt

Conservative leverage

Moderate leverage

High-risk leverage

Near liquidation

Multiple collateral assets

Multiple debt assets

Definition of Done

Expected results are manually verified and stored as immutable test fixtures.

---

# TASK M2-029

Title

Implement Formula Regression Suite

Priority

P0

Effort

L

Dependencies

M2-028

Description

Create regression tests covering all documented Formula IDs.

Requirements

Every Formula ID has at least one normal test.

Critical risk formulas have boundary and error tests.

Golden Reference results remain unchanged unless formally approved.

Definition of Done

A formula coverage report identifies no untested Version 1 Formula IDs.

---

# TASK M2-030

Title

Benchmark Engine Performance

Priority

P2

Effort

S

Dependencies

M2-029

Description

Measure Engine execution performance.

Benchmark

Portfolio summary

Health Factor

Liquidation calculations

Loop strategy

Single scenario

Scenario comparison

Definition of Done

Calculations satisfy the performance targets defined in the Build Guide.

---

# TASK M2-031

Title

Publish Formula Engine API

Priority

P0

Effort

M

Dependencies

M2-029

Description

Create the public Engine API used by Services.

Requirements

Expose only supported public functions.

Hide internal helpers.

Export shared public types.

Document each public operation.

Definition of Done

Application Services can use the Engine without importing internal module files.

---

# TASK M2-032

Title

Complete Formula Traceability Audit

Priority

P0

Effort

M

Dependencies

M2-031

Description

Verify alignment between documentation, implementation, and tests.

For every Formula ID confirm

Documentation exists.

Canonical implementation exists.

Tests exist.

Public output includes the correct Formula ID.

Dependencies are known.

Definition of Done

No undocumented, duplicated, or untested Version 1 calculations remain.

---

# TESTING REQUIREMENTS

Every formula task should include

Normal-case tests

Boundary tests

Invalid-input tests

Zero-value tests where valid

High-value tests

Precision tests

Regression tests where relevant

Tests must be deterministic.

External APIs must never be required.

---

# MILESTONE ACCEPTANCE CRITERIA

✓ Formula Engine has no framework dependencies.

✓ Decimal arithmetic is used consistently.

✓ All Version 1 Formula IDs are implemented.

✓ Input validation is complete.

✓ Portfolio calculations pass.

✓ Health Factor calculations pass.

✓ Liquidation calculations pass.

✓ Interest calculations pass.

✓ Loop calculations pass.

✓ Simulation calculations pass.

✓ Exit calculations pass.

✓ Recommendation rules are deterministic.

✓ Golden Reference tests pass.

✓ Formula traceability audit passes.

✓ Public Engine API is documented.

---

# MILESTONE DEFINITION OF DONE

Milestone 2 is complete when the Formula Engine can independently calculate every financial result required by ProfitPilot Version 1.

The Engine must be

Deterministic

Tested

Documented

Traceable

Reusable

Framework-independent

No UI or Service implementation should be required to verify its correctness.

---

END OF PAGE 3

NEXT

Page 4

Milestones 3 and 4 — Core Services & Portfolio Management

# 06_TASKS

Project

ProfitPilot

Page

4 of 10

Title

Milestones 3 and 4 — Core Services & Portfolio Management

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

Milestones 1–2

---

# PAGE OBJECTIVE

Connect the Formula Engine to the application through typed Services, then implement complete portfolio creation, editing, selection, and validation workflows.

At the end of this page, ProfitPilot should support multiple portfolios and expose reliable calculated portfolio results without placing business logic inside the UI.

---

# MILESTONE 3

Core Services

---

# MILESTONE 3 OBJECTIVE

Implement the application Services that coordinate data, Engine calculations, storage, and UI-facing results.

Services should translate application requests into domain inputs, call the Formula Engine, and return clean typed results.

Services must not contain duplicated formulas.

---

# MILESTONE 3 DELIVERABLES

✓ Service architecture implemented

✓ Portfolio Service implemented

✓ Market Data Service implemented

✓ Protocol Parameter Service implemented

✓ Simulation Service implemented

✓ Loop Strategy Service implemented

✓ Exit Planning Service implemented

✓ Recommendation Service implemented

✓ Standard application errors implemented

✓ Service tests completed

---

# TASK M3-001

Title

Create Service Foundation

Priority

P0

Effort

M

Dependencies

M2-031

Description

Create the Service layer structure defined in the Build Guide.

Include

```text
services/
├── portfolio/
├── market/
├── protocol/
├── simulation/
├── loop/
├── exit/
├── recommendation/
├── persistence/
├── import/
├── export/
├── shared/
└── index.ts
```

Definition of Done

Services are accessible through documented public entry points.

No Service imports React components.

---

# TASK M3-002

Title

Create Standard Service Result Model

Priority

P0

Effort

S

Dependencies

M3-001

Description

Implement typed Service results.

Include

Data

Warnings

Errors

Metadata

Source status

Calculation timestamp

Engine version

Formula version

Definition of Done

All public Services return a predictable structure.

---

# TASK M3-003

Title

Implement Application Error Model

Priority

P0

Effort

S

Dependencies

M3-002

Description

Create standardized application-layer errors.

Categories

Validation

Calculation

Persistence

Provider

Authentication

Synchronization

Import

Export

Unknown

Definition of Done

Service errors can be displayed safely without exposing internal implementation details.

---

# TASK M3-004

Title

Implement Portfolio Mapping Utilities

Priority

P0

Effort

M

Dependencies

M2-002

M3-001

Description

Create mapping functions between persistence models, application models, and Formula Engine inputs.

Requirements

Keep mappings explicit.

Validate required fields.

Avoid unsafe type casting.

Do not format values for display.

Definition of Done

Portfolio data can move between layers without leaking persistence-specific structures into the Engine.

---

# TASK M3-005

Title

Implement Portfolio Summary Service

Priority

P0

Effort

L

Dependencies

M2-031

M3-004

Description

Create a Service that generates the complete calculated portfolio summary.

Include

Collateral value

Debt value

Net equity

LTV

Leverage

Health Factor

Liquidation information

Interest cost

Warnings

Definition of Done

The UI can request one portfolio summary without calling individual Engine modules directly.

---

# TASK M3-006

Title

Implement Portfolio Action Preview Service

Priority

P0

Effort

L

Dependencies

M3-005

Description

Preview the effect of portfolio actions before saving them.

Actions

Add collateral

Withdraw collateral

Borrow

Repay

Change market price

Change protocol parameters

Definition of Done

Each preview returns before-and-after values and does not mutate the original portfolio.

---

# TASK M3-007

Title

Implement Market Data Service

Priority

P1

Effort

M

Dependencies

M3-002

Description

Create a Service for retrieving and normalizing market prices.

Support

Manual prices

Provider prices

Stale-data detection

Fallback behavior

Price timestamps

Definition of Done

Features consume normalized market quotes without depending on provider-specific formats.

---

# TASK M3-008

Title

Implement Protocol Parameter Service

Priority

P0

Effort

M

Dependencies

M3-002

Description

Create a Service for supplying Aave protocol parameters to calculations.

Include

Maximum LTV

Liquidation threshold

Borrow rate

Asset configuration

Data source

Freshness timestamp

Definition of Done

No feature or Engine module hardcodes protocol parameters.

---

# TASK M3-009

Title

Implement Simulation Service

Priority

P1

Effort

L

Dependencies

M2-022

M3-005

Description

Coordinate scenario creation and comparison.

Responsibilities

Validate scenario inputs.

Call Engine simulation functions.

Attach current portfolio baseline.

Return comparison-ready results.

Preserve assumptions.

Definition of Done

Simulation features require no direct Formula Engine orchestration.

---

# TASK M3-010

Title

Implement Loop Strategy Service

Priority

P1

Effort

L

Dependencies

M2-018

M3-005

Description

Coordinate Loop Builder calculations.

Responsibilities

Validate strategy settings.

Load protocol parameters.

Apply cost assumptions.

Call loop calculation modules.

Return step-by-step outputs.

Surface safety warnings.

Definition of Done

The Loop Builder can request one complete strategy result from the Service.

---

# TASK M3-011

Title

Implement Exit Planning Service

Priority

P1

Effort

L

Dependencies

M2-024

M3-005

Description

Coordinate full and partial exit planning.

Include

Current portfolio baseline

Target validation

Exit calculations

Transaction assumptions

Feasibility result

Before-and-after comparison

Definition of Done

Exit Planner components do not perform calculation orchestration.

---

# TASK M3-012

Title

Implement Recommendation Service

Priority

P1

Effort

M

Dependencies

M2-026

M3-005

Description

Generate transparent recommendations from calculated portfolio data.

Include

Priority

Category

Risk level

Explanation

Suggested action

Expected effect

Relevant Formula IDs

Definition of Done

Recommendations are deterministic, explainable, and ordered consistently.

---

# TASK M3-013

Title

Implement Service Dependency Injection

Priority

P2

Effort

M

Dependencies

M3-007

M3-008

Description

Allow Services to receive providers and persistence adapters through typed dependencies.

Goals

Improve testability.

Support manual and cloud modes.

Avoid hardcoded infrastructure.

Enable provider replacement.

Definition of Done

Service tests can run using in-memory dependencies.

---

# TASK M3-014

Title

Create Service Integration Tests

Priority

P0

Effort

L

Dependencies

M3-005 through M3-012

Description

Test Service and Engine workflows together.

Cover

Valid portfolio summary

Invalid portfolio

Manual market data

Stale provider data

Simulation comparison

Unsafe loop strategy

Infeasible exit target

Recommendation generation

Definition of Done

Core workflows pass without external network calls.

---

# MILESTONE 3 ACCEPTANCE CRITERIA

✓ Services use the Formula Engine rather than duplicating formulas.

✓ Service outputs are typed and predictable.

✓ Application errors are standardized.

✓ Market data supports manual fallback.

✓ Protocol parameters are supplied through Services.

✓ Portfolio summaries are generated through one coordinated workflow.

✓ Simulation, loop, exit, and recommendation Services pass tests.

✓ Services are independent of React.

---

# MILESTONE 3 DEFINITION OF DONE

Milestone 3 is complete when every major feature can obtain its domain results through a Service without directly orchestrating Engine modules, persistence adapters, or external providers.

---

# MILESTONE 4

Portfolio Management

---

# MILESTONE 4 OBJECTIVE

Implement the complete portfolio-management experience.

Users should be able to create, view, edit, duplicate, switch, archive, and delete portfolios while maintaining valid collateral, debt, market, and protocol data.

Version 1 must support multiple portfolios.

---

# MILESTONE 4 DELIVERABLES

✓ Portfolio domain model implemented

✓ Portfolio store implemented

✓ Portfolio list implemented

✓ Portfolio creation implemented

✓ Portfolio editing implemented

✓ Position management implemented

✓ Portfolio switching implemented

✓ Portfolio duplication implemented

✓ Portfolio deletion implemented

✓ Auto-save behavior implemented

✓ Empty and error states completed

✓ Portfolio workflows tested

---

# TASK M4-001

Title

Create Portfolio Application Types

Priority

P0

Effort

S

Dependencies

M3-004

Description

Define application-layer portfolio models.

Include

Portfolio identity

Name

Description

Base currency

Collateral positions

Debt positions

Settings

Market prices

Protocol configuration

Created and updated timestamps

Definition of Done

Portfolio types remain independent of React and database-specific fields.

---

# TASK M4-002

Title

Create Portfolio Validation Schemas

Priority

P0

Effort

M

Dependencies

M4-001

Description

Create Zod schemas for portfolio and position inputs.

Validate

Required names

Supported assets

Token quantities

Prices

Debt amounts

Percentages

Duplicate positions

Protocol settings

Definition of Done

Invalid portfolio data is rejected before reaching Services or persistence.

---

# TASK M4-003

Title

Implement Portfolio Store

Priority

P0

Effort

L

Dependencies

M4-001

M3-005

Description

Create the Zustand portfolio store.

State

Portfolio collection

Active portfolio ID

Loading status

Save status

Errors

Last synchronized time

Actions

Load

Create

Update

Select

Duplicate

Archive

Delete

Definition of Done

Store actions remain focused on state transitions and delegate calculations and persistence to Services.

---

# TASK M4-004

Title

Implement Portfolio List Page

Priority

P1

Effort

M

Dependencies

M4-003

Description

Create the page for viewing all portfolios.

Display

Portfolio name

Net equity

Health Factor

Debt

Last updated

Storage status

Include

Create action

Select action

Empty state

Loading state

Error state

Definition of Done

Users can identify and open any saved portfolio.

---

# TASK M4-005

Title

Implement Portfolio Creation Flow

Priority

P0

Effort

L

Dependencies

M4-002

M4-003

Description

Create a guided portfolio setup flow.

Collect

Portfolio name

Base currency

Collateral positions

Debt positions

Manual BTC price

Protocol parameters or preset

Optional safety targets

Definition of Done

A valid portfolio is created, selected, calculated, and saved.

---

# TASK M4-006

Title

Implement Portfolio Details Form

Priority

P0

Effort

M

Dependencies

M4-005

Description

Create a form for editing general portfolio information.

Fields

Name

Description

Base currency

Default display settings

Safety target settings

Requirements

Use React Hook Form.

Use Zod validation.

Support automatic saving.

Definition of Done

Changes persist and do not alter position balances unexpectedly.

---

# TASK M4-007

Title

Implement Collateral Position Management

Priority

P0

Effort

L

Dependencies

M4-002

M4-003

Description

Allow users to add, edit, and remove collateral positions.

Fields

Asset

Quantity

Price source

Manual price

Maximum LTV

Liquidation threshold

Requirements

Prevent duplicate invalid positions.

Preview effects before destructive changes.

Definition of Done

Portfolio summaries update correctly after each collateral change.

---

# TASK M4-008

Title

Implement Debt Position Management

Priority

P0

Effort

L

Dependencies

M4-002

M4-003

Description

Allow users to add, edit, and remove debt positions.

Fields

Asset

Debt amount

Price

Borrow rate

Rate type

Requirements

Validate non-negative debt.

Support zero-debt portfolios.

Preview Health Factor impact.

Definition of Done

Debt changes produce correct calculated results and warnings.

---

# TASK M4-009

Title

Implement Portfolio Action Preview

Priority

P1

Effort

M

Dependencies

M3-006

M4-007

M4-008

Description

Show the calculated impact of a proposed position change before confirmation.

Display

Net equity change

LTV change

Health Factor change

Liquidation price change

Warnings

Definition of Done

Risk-increasing changes require explicit confirmation after preview.

---

# TASK M4-010

Title

Implement Active Portfolio Switching

Priority

P0

Effort

M

Dependencies

M4-003

M4-004

Description

Allow users to change the active portfolio from the application shell.

Requirements

Preserve unsaved changes safely.

Load calculated summary.

Update page context.

Retain selection after refresh.

Definition of Done

Switching portfolios never mixes state between portfolios.

---

# TASK M4-011

Title

Implement Portfolio Duplication

Priority

P1

Effort

S

Dependencies

M4-003

Description

Allow users to create a copy of an existing portfolio.

Requirements

Generate a new identity.

Copy positions and settings.

Do not copy synchronization metadata.

Append a clear copy name.

Definition of Done

The duplicate can be edited independently from the source portfolio.

---

# TASK M4-012

Title

Implement Portfolio Archive and Delete

Priority

P1

Effort

M

Dependencies

M4-003

Description

Support safe portfolio removal.

Archive

Hide from active lists while retaining data.

Delete

Require confirmation.

Explain consequences.

Prevent accidental deletion of the active portfolio without selecting a replacement.

Definition of Done

Deletion and archive actions behave predictably and are recoverable where documented.

---

# TASK M4-013

Title

Implement Portfolio Auto-Save

Priority

P1

Effort

M

Dependencies

M4-003

M4-006

M4-007

M4-008

Description

Persist meaningful portfolio changes automatically.

Requirements

Debounce rapid edits.

Display save state.

Retry transient failures.

Avoid saving invalid drafts.

Prevent stale updates from overwriting newer state.

Definition of Done

Users receive clear saved, saving, offline, and failed states.

---

# TASK M4-014

Title

Implement Manual Price Controls

Priority

P0

Effort

M

Dependencies

M3-007

M4-007

M4-008

Description

Allow users to enter and update prices manually.

Include

Price input

Timestamp

Manual-data indicator

Reset action

Stale-data warning

Definition of Done

ProfitPilot remains fully functional without external price providers.

---

# TASK M4-015

Title

Implement Protocol Configuration Controls

Priority

P0

Effort

M

Dependencies

M3-008

M4-007

Description

Allow users to select a supported protocol preset or enter parameters manually.

Include

Maximum LTV

Liquidation threshold

Borrow rate

Parameter source

Freshness status

Definition of Done

Changes trigger recalculation and clearly identify manual assumptions.

---

# TASK M4-016

Title

Implement Portfolio Empty States

Priority

P2

Effort

S

Dependencies

M4-004

Description

Create clear empty states for

No portfolios

No collateral

No debt

Missing prices

Missing protocol parameters

Definition of Done

Every empty state explains the issue and provides an appropriate next action.

---

# TASK M4-017

Title

Implement Portfolio Error Recovery

Priority

P1

Effort

M

Dependencies

M3-003

M4-003

Description

Handle portfolio loading, calculation, validation, and saving failures.

Include

Retry

Return to portfolio list

Restore last valid state

Export recovery copy where possible

Definition of Done

A failed operation does not silently destroy or replace valid portfolio data.

---

# TASK M4-018

Title

Create Portfolio Workflow Tests

Priority

P0

Effort

L

Dependencies

M4-005 through M4-017

Description

Test complete portfolio-management workflows.

Cover

Create first portfolio

Create second portfolio

Switch portfolios

Edit collateral

Edit debt

Use manual prices

Duplicate portfolio

Archive portfolio

Delete portfolio

Recover from invalid input

Definition of Done

Critical portfolio workflows pass in integration and Playwright tests.

---

# MILESTONE 4 ACCEPTANCE CRITERIA

✓ Multiple portfolios are supported.

✓ Users can create and edit portfolios.

✓ Collateral and debt positions are validated.

✓ Manual prices and parameters are supported.

✓ Portfolio changes update calculated summaries.

✓ Risk-increasing actions provide previews.

✓ Active portfolio switching is isolated and reliable.

✓ Auto-save communicates status clearly.

✓ Destructive actions require confirmation.

✓ Portfolio workflows pass tests.

---

# MILESTONE 4 DEFINITION OF DONE

Milestone 4 is complete when a user can create and manage multiple valid portfolios from the interface and obtain accurate calculated portfolio results without using the Dashboard, Simulation Workspace, or strategy tools.

The portfolio-management foundation must be stable enough for all later features to consume the active portfolio as their shared source of truth.

---

END OF PAGE 4

NEXT

Page 5

Milestone 5 — Dashboard

# 06_TASKS

Project

ProfitPilot

Page

5 of 10

Title

Milestone 5 — Dashboard

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

Milestones 1–4

---

# MILESTONE OBJECTIVE

Implement the primary Dashboard for ProfitPilot.

The Dashboard should convert the active portfolio into a clear, decision-oriented summary.

It must help the user quickly understand

Portfolio value

Debt exposure

Health Factor

Liquidation risk

Borrowing cost

Leverage

Recommended next actions

The Dashboard should not behave like a trading terminal.

It should remain calm, readable, and focused on financial safety.

---

# DELIVERABLES

✓ Dashboard route implemented

✓ Portfolio summary header implemented

✓ KPI cards implemented

✓ Health Factor section implemented

✓ Liquidation risk section implemented

✓ Portfolio composition section implemented

✓ Debt and interest section implemented

✓ Recommendation section implemented

✓ Price and data freshness indicators implemented

✓ Empty, loading, and error states implemented

✓ Responsive behavior completed

✓ Dashboard tests completed

---

# IMPLEMENTATION ORDER

Dashboard Foundation

↓

Summary Header

↓

KPI Metrics

↓

Risk Sections

↓

Portfolio Composition

↓

Recommendations

↓

Responsive and Accessible States

↓

Testing

The Dashboard should initially consume existing Service outputs without introducing new financial calculations.

---

# TASK M5-001

Title

Create Dashboard Route

Priority

P0

Effort

S

Dependencies

M4-010

Description

Create the main Dashboard route using the shared application layout.

Requirements

Use the active portfolio.

Redirect or guide users when no portfolio exists.

Support loading and error states.

Use feature-based components.

Definition of Done

The Dashboard route renders safely for every portfolio state.

---

# TASK M5-002

Title

Create Dashboard Feature Structure

Priority

P0

Effort

S

Dependencies

M5-001

Description

Create the Dashboard feature module.

Suggested structure

```text
features/dashboard/
├── components/
├── hooks/
├── services/
├── types/
├── utils/
├── tests/
└── index.ts
```

Definition of Done

Dashboard-specific implementation remains isolated from generic shared components.

---

# TASK M5-003

Title

Create Dashboard View Model

Priority

P0

Effort

M

Dependencies

M3-005

M5-002

Description

Create a typed view model that converts Portfolio Summary Service results into UI-ready values.

Include

Raw values

Formatted values

Labels

Status classifications

Warnings

Data freshness

Formula references where required

Requirements

Do not calculate financial metrics.

Do not mutate Service results.

Definition of Done

Dashboard components consume one stable typed model.

---

# TASK M5-004

Title

Implement Dashboard Summary Header

Priority

P1

Effort

M

Dependencies

M5-003

Description

Create the top Dashboard section.

Display

Active portfolio name

Description or strategy label

Current BTC price

Last updated time

Storage status

Manual or provider data source

Include

Portfolio switcher

Refresh action

Edit portfolio action

Definition of Done

The user can identify which portfolio and data source are currently active.

---

# TASK M5-005

Title

Create Shared KPI Card Component

Priority

P0

Effort

M

Dependencies

M1-006

Description

Create a reusable KPI card.

Support

Title

Primary value

Secondary value

Status

Tooltip

Trend or comparison text

Loading state

Warning state

Developer Mode details

Requirements

Accessible markup.

No financial calculations.

Responsive sizing.

Definition of Done

The component supports all Dashboard KPI use cases without feature-specific logic.

---

# TASK M5-006

Title

Implement Core KPI Grid

Priority

P0

Effort

L

Dependencies

M5-003

M5-005

Description

Display the core portfolio metrics.

Cards

Net portfolio value

Total collateral

Total debt

Current Health Factor

Current LTV

Effective leverage

Annual interest cost

Liquidation price

Requirements

Use Service outputs only.

Use consistent formatting.

Display unavailable values clearly.

Definition of Done

Every critical portfolio metric is visible without scrolling excessively on desktop.

---

# TASK M5-007

Title

Implement Health Factor Status Component

Priority

P0

Effort

M

Dependencies

M5-003

Description

Create a dedicated Health Factor section.

Display

Current Health Factor

Configured target

Risk classification

Distance from target

Required action to restore target where available

Include

Plain-language explanation

Formula reference in Developer Mode

Definition of Done

The user can understand both the numeric value and its practical meaning.

---

# TASK M5-008

Title

Implement Health Factor Range Visualization

Priority

P1

Effort

M

Dependencies

M5-007

Description

Create a visual range for Health Factor.

Show

Liquidation threshold

Critical zone

Caution zone

Target zone

Current position

Requirements

Do not imply guaranteed safety.

Support screen readers.

Do not rely on color alone.

Definition of Done

The visualization communicates risk position accessibly and accurately.

---

# TASK M5-009

Title

Implement Liquidation Risk Panel

Priority

P0

Effort

L

Dependencies

M5-003

M2-010

Description

Create a section summarizing liquidation exposure.

Display

Estimated liquidation BTC price

Percentage decline to liquidation

Current market price

Liquidation distance

Debt repayment required for target safety

Collateral addition required for target safety

Assumptions

Definition of Done

The section clearly distinguishes current values from calculated estimates.

---

# TASK M5-010

Title

Implement Risk Warning Banner

Priority

P0

Effort

M

Dependencies

M5-007

M5-009

Description

Display prominent warnings when portfolio risk crosses documented thresholds.

Warning cases

Health Factor below configured target

Health Factor near liquidation

Missing or stale price data

Invalid protocol parameters

High interest burden

Calculation warnings

Requirements

Warnings must be actionable.

Warnings must not block valid analysis unnecessarily.

Definition of Done

Each warning includes a reason and recommended next action.

---

# TASK M5-011

Title

Implement Portfolio Composition Section

Priority

P1

Effort

L

Dependencies

M5-003

Description

Display collateral and debt composition.

Include

Collateral positions

Debt positions

Asset quantity

Current price

Position value

Portfolio percentage

Protocol parameters where relevant

Use

Table on larger screens

Compact cards on smaller screens

Definition of Done

Users can understand what contributes to total collateral and debt.

---

# TASK M5-012

Title

Implement Portfolio Allocation Chart

Priority

P2

Effort

M

Dependencies

M5-011

Description

Create an optional chart for portfolio composition.

Display

Collateral allocation

Debt allocation

Requirements

Use existing calculated percentages.

Provide accessible text equivalents.

Hide the chart when it provides no additional value.

Definition of Done

The chart supplements rather than replaces tabular data.

---

# TASK M5-013

Title

Implement Debt and Interest Panel

Priority

P1

Effort

M

Dependencies

M5-003

Description

Create a focused section for borrowing costs.

Display

Total debt

Current borrow rate

Annual interest cost

Monthly interest cost

Daily interest cost

Projected debt where available

Rate source

Requirements

Clearly distinguish current rate from projected assumptions.

Definition of Done

The user can understand the ongoing cost of maintaining the position.

---

# TASK M5-014

Title

Implement Leverage Summary Section

Priority

P1

Effort

M

Dependencies

M5-003

Description

Display leverage-related metrics.

Include

Gross exposure

Net equity

Leverage ratio

Debt-to-equity ratio

Effective BTC exposure

Plain-language explanation

Definition of Done

The section explains leverage without requiring advanced financial knowledge.

---

# TASK M5-015

Title

Implement Recommendation Summary

Priority

P1

Effort

L

Dependencies

M3-012

M5-003

Description

Create a Dashboard section for prioritized recommendations.

Display

Top recommendations

Priority

Category

Risk level

Explanation

Suggested action

Expected effect

Include

View all action

Dismiss or acknowledge behavior only if documented

Definition of Done

Recommendations are transparent and traceable to deterministic rules.

---

# TASK M5-016

Title

Implement Dashboard Quick Actions

Priority

P1

Effort

M

Dependencies

M5-001

Description

Provide navigation shortcuts to common workflows.

Actions

Edit portfolio

Run simulation

Build loop strategy

Create exit plan

Update prices

Export portfolio

Requirements

Actions should reflect current portfolio state.

Unavailable actions should explain why.

Definition of Done

Users can reach the next relevant workflow directly from the Dashboard.

---

# TASK M5-017

Title

Implement Data Freshness Indicators

Priority

P0

Effort

M

Dependencies

M3-007

M3-008

M5-004

Description

Display freshness information for prices and protocol parameters.

Show

Source

Last updated time

Fresh or stale classification

Manual-data status

Refresh status

Requirements

Stale data must remain usable with a visible warning.

Definition of Done

Users always know whether calculations rely on current, stale, or manual inputs.

---

# TASK M5-018

Title

Implement Dashboard Refresh Workflow

Priority

P1

Effort

M

Dependencies

M5-017

Description

Allow the user to refresh available external data.

Workflow

Request new market data.

Request updated protocol parameters.

Validate responses.

Recalculate portfolio summary.

Retain previous valid values if refresh fails.

Definition of Done

Refresh failures do not erase valid existing data.

---

# TASK M5-019

Title

Implement Dashboard Loading States

Priority

P1

Effort

S

Dependencies

M5-005

Description

Create loading states for Dashboard sections.

Include

Summary skeleton

KPI skeletons

Table skeleton

Recommendation skeleton

Requirements

Avoid layout shifts.

Do not display misleading placeholder values.

Definition of Done

The Dashboard remains visually stable while data loads.

---

# TASK M5-020

Title

Implement Dashboard Empty States

Priority

P1

Effort

S

Dependencies

M5-001

Description

Create empty states for

No portfolio

Portfolio without collateral

Portfolio without debt

Missing prices

Missing protocol parameters

No recommendations

Definition of Done

Each empty state explains the missing requirement and provides a clear action.

---

# TASK M5-021

Title

Implement Dashboard Error Recovery

Priority

P0

Effort

M

Dependencies

M3-003

M5-001

Description

Handle Dashboard calculation, provider, and persistence errors.

Include

Retry calculation

Retry refresh

Use last valid data

Return to portfolio management

Export recovery copy where applicable

Definition of Done

Errors do not leave the Dashboard blank or destroy valid state.

---

# TASK M5-022

Title

Implement Dashboard Developer Mode

Priority

P2

Effort

M

Dependencies

M5-003

Description

Expose advanced calculation details when Developer Mode is enabled.

Display where appropriate

Raw values

Formula IDs

Engine version

Formula version

Assumptions

Warnings

Calculation timestamp

Requirements

Developer Mode must not change calculation behavior.

Definition of Done

Advanced information is available without cluttering the default experience.

---

# TASK M5-023

Title

Implement Dashboard Responsive Layout

Priority

P0

Effort

L

Dependencies

M5-006 through M5-021

Description

Optimize the Dashboard for supported screen sizes.

Desktop

Multi-column KPI and analysis layout.

Tablet

Reduced columns with preserved hierarchy.

Mobile

Single-column layout with compact summaries.

Requirements

No horizontal page scrolling.

Tables must adapt appropriately.

Critical metrics remain near the top.

Definition of Done

All Dashboard functionality remains usable on mobile, tablet, and desktop.

---

# TASK M5-024

Title

Complete Dashboard Accessibility Pass

Priority

P0

Effort

M

Dependencies

M5-023

Description

Verify Dashboard accessibility.

Review

Heading order

Keyboard navigation

Focus visibility

Status announcements

Chart alternatives

Table semantics

Tooltip accessibility

Color-independent warnings

Definition of Done

The Dashboard meets the accessibility requirements defined in the Build Guide.

---

# TASK M5-025

Title

Create Dashboard Component Tests

Priority

P0

Effort

L

Dependencies

M5-006 through M5-022

Description

Test individual Dashboard components.

Cover

Normal values

Zero debt

Missing data

Warning states

Critical Health Factor

Stale data

Developer Mode

Long values

Definition of Done

All critical display states have automated tests.

---

# TASK M5-026

Title

Create Dashboard Integration Tests

Priority

P0

Effort

L

Dependencies

M5-025

Description

Test Dashboard integration with Stores and Services.

Cover

Load active portfolio

Generate summary

Refresh price

Switch portfolio

Display warnings

Recover from Service failure

Definition of Done

Dashboard data remains consistent across state transitions.

---

# TASK M5-027

Title

Create Dashboard End-to-End Tests

Priority

P0

Effort

L

Dependencies

M5-026

Description

Create Playwright tests for critical Dashboard workflows.

Flows

Open first portfolio

Review core metrics

Switch portfolios

Update manual BTC price

Observe recalculation

Open risk details

Navigate to Simulation Workspace

Navigate to Exit Planner

Definition of Done

Critical Dashboard workflows pass in supported viewport sizes.

---

# TASK M5-028

Title

Validate Dashboard Against UI Specification

Priority

P0

Effort

M

Dependencies

M5-027

Description

Perform a final implementation audit against `03_UI.md`.

Verify

Information hierarchy

Required components

Terminology

Formatting

States

Responsive behavior

Accessibility

Definition of Done

No undocumented UI deviations remain without explicit approval.

---

# MILESTONE ACCEPTANCE CRITERIA

✓ Dashboard uses the active portfolio.

✓ Core portfolio metrics are displayed.

✓ Health Factor is explained clearly.

✓ Liquidation risk is visible and actionable.

✓ Debt and interest costs are displayed.

✓ Portfolio composition is understandable.

✓ Recommendations are transparent.

✓ Manual and stale data are clearly identified.

✓ Dashboard supports loading, empty, and error states.

✓ Responsive behavior is complete.

✓ Accessibility requirements are satisfied.

✓ Dashboard tests pass.

---

# MILESTONE DEFINITION OF DONE

Milestone 5 is complete when a user can open the active portfolio and understand its financial condition, leverage, borrowing cost, and liquidation risk without navigating to another page.

The Dashboard must provide a reliable starting point for deciding whether to

Maintain the position

Reduce debt

Add collateral

Run a simulation

Build a loop strategy

Prepare an exit plan

No financial calculation may be implemented directly inside Dashboard components.

---

END OF PAGE 5

NEXT

Page 6

Milestone 6 — Simulation Workspace

# 06_TASKS

Project

ProfitPilot

Page

6 of 10

Title

Milestone 6 — Simulation Workspace

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

Milestones 1–5

---

# MILESTONE OBJECTIVE

Implement the Simulation Workspace.

This is the primary analysis environment where users can safely explore "what-if" scenarios without modifying their actual portfolio.

Every simulation must be isolated, reproducible, and transparent.

Running simulations must never change portfolio data until the user explicitly applies an action.

---

# DELIVERABLES

✓ Simulation Workspace route

✓ Simulation state management

✓ Scenario Builder

✓ Price simulations

✓ Interest rate simulations

✓ Portfolio action simulations

✓ Multi-scenario comparison

✓ Scenario saving

✓ Scenario loading

✓ Scenario export

✓ Scenario history

✓ Complete testing

---

# IMPLEMENTATION ORDER

Simulation Foundation

↓

Scenario Builder

↓

Scenario Calculations

↓

Comparison Tools

↓

Persistence

↓

Visualization

↓

Testing

---

# TASK M6-001

Title

Create Simulation Workspace

Priority

P0

Effort

S

Dependencies

M5-028

Description

Create the Simulation Workspace route.

Include

Workspace layout

Simulation sidebar

Scenario editor

Results area

Comparison area

Responsive layout

Definition of Done

Users can access the Simulation Workspace from the Dashboard.

---

# TASK M6-002

Title

Create Simulation Feature Structure

Priority

P0

Effort

S

Dependencies

M6-001

Description

Create the Simulation feature module.

```text
features/simulation/
├── components/
├── hooks/
├── services/
├── state/
├── types/
├── utils/
├── tests/
└── index.ts
```

Definition of Done

Simulation code remains isolated from unrelated features.

---

# TASK M6-003

Title

Implement Simulation Store

Priority

P0

Effort

L

Dependencies

M6-002

Description

Create Zustand state for simulations.

Store

Current scenario

Saved scenarios

Comparison selection

Simulation status

Errors

Preview mode

Definition of Done

Simulation state is completely independent from portfolio state.

---

# TASK M6-004

Title

Create Scenario Builder

Priority

P0

Effort

L

Dependencies

M6-003

M3-009

Description

Implement the Scenario Builder interface.

Users can modify

BTC price

Borrow rate

Collateral

Debt

Target Health Factor

Time horizon

Definition of Done

Scenario inputs are validated before calculation.

---

# TASK M6-005

Title

Implement Price Scenario Simulation

Priority

P0

Effort

M

Dependencies

M6-004

Description

Allow simulation of BTC price changes.

Support

Manual price

Percentage change

Preset scenarios

Custom scenarios

Definition of Done

Portfolio values update using Simulation Service outputs.

---

# TASK M6-006

Title

Implement Interest Rate Simulation

Priority

P1

Effort

M

Dependencies

M6-004

Description

Simulate borrow rate changes.

Include

Rate increase

Rate decrease

Custom rate

Projected interest cost

Definition of Done

Users understand the cost implications of changing rates.

---

# TASK M6-007

Title

Implement Time Projection

Priority

P1

Effort

L

Dependencies

M6-006

Description

Project portfolio changes over time.

Support

30 days

90 days

180 days

1 year

Custom duration

Definition of Done

Time assumptions are clearly displayed.

---

# TASK M6-008

Title

Implement Portfolio Action Simulation

Priority

P0

Effort

L

Dependencies

M6-004

Description

Simulate portfolio actions.

Actions

Add collateral

Withdraw collateral

Borrow

Repay

Combined actions

Definition of Done

Users can evaluate actions before applying them.

---

# TASK M6-009

Title

Implement Scenario Summary

Priority

P0

Effort

M

Dependencies

M6-005

M6-008

Description

Display

Portfolio value

Debt

Health Factor

Liquidation price

Leverage

Interest cost

Profit/Loss

Warnings

Definition of Done

Summary displays only calculated Service results.

---

# TASK M6-010

Title

Implement Scenario Comparison

Priority

P0

Effort

L

Dependencies

M6-009

Description

Compare multiple scenarios side-by-side.

Compare

Equity

Debt

Health Factor

Interest

Leverage

Liquidation price

Risk

Definition of Done

Users can compare scenarios without recalculation inside the UI.

---

# TASK M6-011

Title

Implement Scenario Charts

Priority

P1

Effort

M

Dependencies

M6-010

Description

Create charts for

Portfolio value

Health Factor

Debt

Interest cost

BTC exposure

Requirements

Accessible alternatives

Responsive

Definition of Done

Charts enhance understanding without replacing numerical data.

---

# TASK M6-012

Title

Implement Scenario Timeline

Priority

P2

Effort

M

Dependencies

M6-007

Description

Display projected portfolio evolution across the selected time horizon.

Definition of Done

Users can visualize projected changes over time.

---

# TASK M6-013

Title

Implement Simulation Assumptions Panel

Priority

P0

Effort

S

Dependencies

M6-009

Description

Display all assumptions used.

Include

Price assumptions

Rate assumptions

Protocol parameters

Fees

Slippage

Formula version

Definition of Done

Every simulation is fully transparent.

---

# TASK M6-014

Title

Implement Simulation Warnings

Priority

P0

Effort

M

Dependencies

M6-009

Description

Display warnings for

Unsafe Health Factor

Near liquidation

Stale prices

Invalid assumptions

High leverage

High borrowing cost

Definition of Done

Warnings explain both the cause and potential impact.

---

# TASK M6-015

Title

Save Simulation

Priority

P1

Effort

M

Dependencies

M6-003

Description

Allow users to save scenarios.

Include

Name

Description

Timestamp

Portfolio reference

Definition of Done

Saved simulations can be reopened later.

---

# TASK M6-016

Title

Load Saved Simulation

Priority

P1

Effort

S

Dependencies

M6-015

Description

Open previously saved simulations.

Requirements

Preserve original assumptions.

Display if portfolio has changed since creation.

Definition of Done

Historical simulations remain reproducible.

---

# TASK M6-017

Title

Duplicate Simulation

Priority

P2

Effort

S

Dependencies

M6-016

Description

Allow users to duplicate a saved scenario for experimentation.

Definition of Done

Copies are fully independent.

---

# TASK M6-018

Title

Delete Simulation

Priority

P2

Effort

XS

Dependencies

M6-016

Description

Delete saved simulations with confirmation.

Definition of Done

Deletion cannot occur accidentally.

---

# TASK M6-019

Title

Export Simulation

Priority

P1

Effort

M

Dependencies

M6-016

Description

Export simulation results.

Formats

JSON

CSV

Future PDF

Include

Inputs

Outputs

Assumptions

Timestamp

Formula version

Definition of Done

Exported simulations are reproducible.

---

# TASK M6-020

Title

Simulation History

Priority

P2

Effort

M

Dependencies

M6-016

Description

Display saved simulation history.

Sort

Date

Portfolio

Scenario name

Definition of Done

Users can quickly locate previous analyses.

---

# TASK M6-021

Title

Responsive Workspace

Priority

P1

Effort

M

Dependencies

M6-020

Description

Optimize Simulation Workspace for desktop, tablet and mobile.

Definition of Done

Simulation tools remain usable on supported screen sizes.

---

# TASK M6-022

Title

Accessibility Review

Priority

P1

Effort

S

Dependencies

M6-021

Description

Verify accessibility.

Review

Keyboard navigation

Forms

Charts

Tables

Screen readers

Definition of Done

Simulation Workspace satisfies accessibility requirements.

---

# TASK M6-023

Title

Unit Tests

Priority

P0

Effort

L

Dependencies

M6-022

Description

Create component and store tests.

Definition of Done

Critical simulation components are covered.

---

# TASK M6-024

Title

Integration Tests

Priority

P0

Effort

L

Dependencies

M6-023

Description

Test

Scenario creation

Scenario editing

Scenario comparison

Simulation saving

Simulation loading

Definition of Done

Simulation workflows operate correctly.

---

# TASK M6-025

Title

End-to-End Tests

Priority

P0

Effort

L

Dependencies

M6-024

Description

Create Playwright tests.

Cover

Open workspace

Create simulation

Modify assumptions

Compare scenarios

Save

Reload

Export

Definition of Done

Critical Simulation Workspace workflows pass successfully.

---

# TASK M6-026

Title

UI Specification Audit

Priority

P0

Effort

M

Dependencies

M6-025

Description

Validate the Simulation Workspace against `03_UI.md`.

Review

Layout

States

Terminology

Accessibility

Responsiveness

Definition of Done

Simulation Workspace matches the documented UI specification.

---

# MILESTONE ACCEPTANCE CRITERIA

✓ Simulation Workspace implemented.

✓ Scenario Builder completed.

✓ Price and interest simulations supported.

✓ Portfolio action simulations implemented.

✓ Multi-scenario comparison completed.

✓ Assumptions fully visible.

✓ Warnings implemented.

✓ Simulation persistence completed.

✓ Export supported.

✓ Responsive layout completed.

✓ Accessibility requirements satisfied.

✓ Tests pass.

---

# MILESTONE DEFINITION OF DONE

Milestone 6 is complete when users can safely experiment with multiple portfolio scenarios, compare outcomes, save their analyses, and understand every assumption used in the calculations without affecting their live portfolio.

The Simulation Workspace must function as an isolated planning environment that relies exclusively on the Formula Engine and Services for all financial calculations.

---

END OF PAGE 6

NEXT

Page 7

Milestone 7 — Strategy Tools (Loop Builder, Exit Planner & Recommendation Engine)

# 06_TASKS

Project

ProfitPilot

Page

7 of 10

Title

Milestone 7 — Strategy Tools

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

Milestones 1–6

---

# MILESTONE OBJECTIVE

Implement the strategy tools that help users evaluate leverage changes, prepare exits, and understand recommended actions.

This milestone includes

Loop Builder

Exit Planner

Recommendation Center

These tools must remain analytical and transparent.

They must not execute transactions, connect wallets for signing, or make autonomous financial decisions.

---

# DELIVERABLES

✓ Loop Builder route implemented

✓ Loop strategy controls implemented

✓ Step-by-step loop results implemented

✓ Loop cost and safety analysis implemented

✓ Exit Planner route implemented

✓ Full and partial exit calculations implemented

✓ Target-based exit planning implemented

✓ Recommendation Center implemented

✓ Recommendation explanations implemented

✓ Strategy saving and export implemented

✓ Responsive and accessible layouts completed

✓ Strategy tool tests completed

---

# IMPLEMENTATION ORDER

Shared Strategy Foundation

↓

Loop Builder

↓

Exit Planner

↓

Recommendation Center

↓

Persistence and Export

↓

Testing and Audit

The three tools should reuse shared portfolio, risk, comparison, warning, and assumption components where practical.

---

# SHARED STRATEGY FOUNDATION

---

# TASK M7-001

Title

Create Strategy Feature Foundations

Priority

P0

Effort

M

Dependencies

M3-010

M3-011

M3-012

Description

Create the feature modules for strategy tools.

Suggested structure

```text
features/
├── loop-builder/
│   ├── components/
│   ├── hooks/
│   ├── state/
│   ├── types/
│   ├── tests/
│   └── index.ts
│
├── exit-planner/
│   ├── components/
│   ├── hooks/
│   ├── state/
│   ├── types/
│   ├── tests/
│   └── index.ts
│
└── recommendations/
    ├── components/
    ├── hooks/
    ├── types/
    ├── tests/
    └── index.ts
```

Definition of Done

Each strategy tool has a clear public entry point and remains isolated from unrelated features.

---

# TASK M7-002

Title

Create Shared Strategy View Models

Priority

P0

Effort

M

Dependencies

M7-001

Description

Create typed view models for strategy results.

Include

Current portfolio baseline

Proposed strategy result

Before-and-after comparison

Warnings

Assumptions

Costs

Formula references

Engine version

Definition of Done

Strategy components consume stable UI-ready models without recalculating financial values.

---

# TASK M7-003

Title

Create Shared Before-and-After Comparison Component

Priority

P1

Effort

M

Dependencies

M7-002

Description

Create a reusable comparison component.

Support

Collateral

Debt

Net equity

Health Factor

LTV

Leverage

Liquidation price

Interest cost

BTC exposure

Requirements

Display improvements and deteriorations without relying on color alone.

Definition of Done

The component supports Loop Builder and Exit Planner results.

---

# TASK M7-004

Title

Create Shared Strategy Assumptions Panel

Priority

P1

Effort

S

Dependencies

M7-002

Description

Create a reusable panel for strategy assumptions.

Display

Market price

Protocol parameters

Borrow rate

Fees

Slippage

Gas estimate

Time horizon

Manual-data status

Formula version

Definition of Done

Users can inspect the assumptions behind every strategy result.

---

# TASK M7-005

Title

Create Shared Strategy Warning System

Priority

P0

Effort

M

Dependencies

M7-002

Description

Create standardized strategy warnings.

Categories

Safety

Liquidation

Borrowing capacity

Interest burden

Transaction cost

Stale data

Invalid target

Infeasible strategy

Requirements

Every warning includes a cause, severity, and suggested response.

Definition of Done

Loop and exit workflows present warnings consistently.

---

# LOOP BUILDER

---

# TASK M7-006

Title

Create Loop Builder Route

Priority

P0

Effort

S

Dependencies

M7-001

Description

Create the Loop Builder page within the shared application layout.

Include

Strategy controls

Current portfolio baseline

Results summary

Loop steps

Safety analysis

Cost analysis

Definition of Done

Users can open the Loop Builder from the Dashboard and Simulation Workspace.

---

# TASK M7-007

Title

Implement Loop Builder Store

Priority

P0

Effort

M

Dependencies

M7-006

Description

Create isolated Zustand state for the Loop Builder.

Store

Strategy inputs

Current result

Calculation status

Warnings

Saved strategies

Selected strategy

Requirements

Do not mutate the active portfolio.

Definition of Done

Loop strategy state remains independent from portfolio and simulation state.

---

# TASK M7-008

Title

Implement Loop Strategy Controls

Priority

P0

Effort

L

Dependencies

M7-007

Description

Create controls for defining a loop strategy.

Inputs

Starting portfolio

Borrow percentage per step

Maximum number of loops

Minimum Health Factor

Maximum LTV

Swap fee

Slippage

Gas estimate

Borrow-rate assumption

Requirements

Use React Hook Form and Zod.

Show validation before calculation.

Definition of Done

Only valid strategy inputs reach the Loop Strategy Service.

---

# TASK M7-009

Title

Implement Loop Presets

Priority

P2

Effort

M

Dependencies

M7-008

Description

Provide optional strategy presets.

Examples

Conservative

Balanced

Aggressive

Custom

Requirements

Presets must expose their assumptions.

Presets must not be described as guaranteed-safe strategies.

Definition of Done

Selecting a preset updates editable controls without hiding any input.

---

# TASK M7-010

Title

Implement Loop Calculation Workflow

Priority

P0

Effort

L

Dependencies

M3-010

M7-008

Description

Connect strategy controls to the Loop Strategy Service.

Workflow

Validate inputs.

Load active portfolio.

Load price and protocol data.

Calculate strategy.

Return steps, costs, warnings, and final state.

Requirements

Debounce live previews where appropriate.

Preserve the last valid result when a new calculation fails.

Definition of Done

The UI receives one complete loop result from the Service.

---

# TASK M7-011

Title

Implement Loop Strategy Summary

Priority

P0

Effort

M

Dependencies

M7-010

Description

Display the final loop strategy outcome.

Include

Final collateral

Final debt

Net equity

Health Factor

LTV

Leverage

BTC exposure

Annual interest cost

Estimated implementation cost

Stop reason

Definition of Done

The summary clearly distinguishes current and proposed portfolio states.

---

# TASK M7-012

Title

Implement Loop Step Table

Priority

P0

Effort

L

Dependencies

M7-010

Description

Display each loop step.

Columns

Step number

Borrow amount

BTC purchased

Collateral after resupply

Debt balance

LTV

Health Factor

Cumulative cost

Include

Compact mobile representation

Expandable details

Definition of Done

Every final strategy value can be traced through its individual steps.

---

# TASK M7-013

Title

Implement Loop Safety Analysis

Priority

P0

Effort

L

Dependencies

M7-010

M7-005

Description

Create a dedicated safety section.

Display

Minimum Health Factor reached

Distance to liquidation

Maximum LTV reached

Remaining borrowing capacity

Configured safety limits

Stop condition

Risk classification

Definition of Done

Unsafe or constrained strategies are clearly explained.

---

# TASK M7-014

Title

Implement Loop Cost Analysis

Priority

P1

Effort

M

Dependencies

M7-010

Description

Display strategy implementation and ongoing costs.

Include

Swap fees

Slippage cost

Gas estimate

Annual interest cost

Monthly interest cost

Total initial cost

Break-even BTC appreciation

Definition of Done

Users can compare leverage benefits against explicit costs.

---

# TASK M7-015

Title

Implement Loop Scenario Sensitivity

Priority

P1

Effort

L

Dependencies

M7-010

M3-009

Description

Allow users to test the proposed loop under adverse conditions.

Presets

BTC price decline

Borrow-rate increase

Combined stress scenario

Custom stress scenario

Display

Resulting Health Factor

Liquidation distance

Equity

Interest cost

Definition of Done

A loop strategy can be stress-tested before being considered viable.

---

# TASK M7-016

Title

Implement Apply Loop as Simulation

Priority

P1

Effort

M

Dependencies

M7-010

M6-003

Description

Allow the proposed loop result to be copied into the Simulation Workspace.

Requirements

Create a new isolated scenario.

Do not modify the active portfolio.

Preserve all assumptions.

Definition of Done

Users can continue analyzing a loop strategy without re-entering data.

---

# TASK M7-017

Title

Implement Loop Strategy Save and Load

Priority

P2

Effort

M

Dependencies

M7-007

M7-010

Description

Allow users to save and reopen loop strategies.

Store

Name

Portfolio reference

Inputs

Outputs

Assumptions

Warnings

Timestamp

Engine and Formula versions

Definition of Done

Saved strategies remain reproducible and identify portfolio changes since creation.

---

# TASK M7-018

Title

Implement Loop Strategy Export

Priority

P2

Effort

M

Dependencies

M7-017

Description

Export loop strategies.

Formats

JSON

CSV

Future PDF

Include

Inputs

Step results

Final outcome

Costs

Warnings

Assumptions

Versions

Definition of Done

The export contains enough information to reproduce the strategy.

---

# EXIT PLANNER

---

# TASK M7-019

Title

Create Exit Planner Route

Priority

P0

Effort

S

Dependencies

M7-001

Description

Create the Exit Planner page.

Include

Exit target controls

Current portfolio baseline

Exit result

Debt repayment breakdown

Retained BTC

Cash proceeds

Warnings

Definition of Done

Users can access the Exit Planner from the Dashboard and strategy navigation.

---

# TASK M7-020

Title

Implement Exit Planner Store

Priority

P0

Effort

M

Dependencies

M7-019

Description

Create isolated Zustand state for exit planning.

Store

Exit type

Target inputs

Current result

Calculation status

Warnings

Saved plans

Requirements

Do not mutate the active portfolio.

Definition of Done

Exit planning state remains separate from portfolio and simulation state.

---

# TASK M7-021

Title

Implement Exit Type Selection

Priority

P0

Effort

M

Dependencies

M7-020

Description

Allow users to select an exit approach.

Types

Full exit

Partial debt repayment

Target Health Factor

Target retained BTC

Target debt balance

Target cash proceeds

Requirements

Display only fields relevant to the selected exit type.

Definition of Done

Each documented exit approach has a clear, validated input flow.

---

# TASK M7-022

Title

Implement Exit Target Form

Priority

P0

Effort

L

Dependencies

M7-021

Description

Create the Exit Planner form.

Inputs may include

Target BTC price

Debt repayment amount

Target Health Factor

BTC quantity to retain

Debt balance to retain

Cash proceeds target

Fees

Slippage

Gas estimate

Requirements

Use React Hook Form and Zod.

Clearly distinguish target price from current price.

Definition of Done

Invalid or impossible target inputs are rejected with useful messages.

---

# TASK M7-023

Title

Implement Exit Calculation Workflow

Priority

P0

Effort

L

Dependencies

M3-011

M7-022

Description

Connect the Exit Planner to the Exit Planning Service.

Workflow

Validate target.

Load current portfolio.

Apply price and cost assumptions.

Calculate exit.

Verify resulting state.

Return feasibility, warnings, and comparison.

Definition of Done

The UI receives one complete exit-plan result from the Service.

---

# TASK M7-024

Title

Implement Full Exit Result

Priority

P0

Effort

M

Dependencies

M7-023

Description

Display the result of fully closing the leveraged position.

Include

BTC sold

Gross sale value

Debt repaid

Interest included

Transaction costs

Net cash proceeds

Remaining collateral

Remaining debt

Definition of Done

The full-exit result reconciles with current portfolio balances.

---

# TASK M7-025

Title

Implement Partial Exit Result

Priority

P0

Effort

L

Dependencies

M7-023

Description

Display partial-exit outcomes.

Include

BTC sold

Debt repaid

BTC retained

Debt retained

Resulting equity

Resulting Health Factor

Resulting liquidation price

Costs

Definition of Done

The user can understand the portfolio state after the proposed exit.

---

# TASK M7-026

Title

Implement Target Health Factor Exit

Priority

P1

Effort

M

Dependencies

M7-023

Description

Calculate the minimum exit action required to reach a target Health Factor.

Display

Collateral sale required

Debt repayment

BTC retained

Resulting Health Factor

Difference from target

Definition of Done

The resulting state is independently verified against the target.

---

# TASK M7-027

Title

Implement Exit Feasibility Analysis

Priority

P0

Effort

M

Dependencies

M7-023

M7-005

Description

Explain whether a requested exit target is feasible.

Check

Available collateral

Debt obligations

Transaction costs

Requested retained BTC

Requested proceeds

Target Health Factor

Definition of Done

Infeasible targets return explicit reasons and possible adjustments.

---

# TASK M7-028

Title

Implement Exit Price Sensitivity

Priority

P1

Effort

M

Dependencies

M7-023

Description

Show how exit outcomes change at different BTC prices.

Compare

Current price

User target price

Lower-price case

Higher-price case

Display

Net proceeds

Debt repaid

BTC retained

Resulting equity

Definition of Done

Users can understand how price uncertainty affects an exit plan.

---

# TASK M7-029

Title

Implement Exit Plan Save and Load

Priority

P1

Effort

M

Dependencies

M7-020

M7-023

Description

Allow users to save and reopen exit plans.

Store

Name

Portfolio reference

Exit type

Targets

Results

Assumptions

Warnings

Timestamp

Engine and Formula versions

Definition of Done

Saved plans remain reproducible and show when the source portfolio has changed.

---

# TASK M7-030

Title

Implement Exit Plan Export

Priority

P1

Effort

M

Dependencies

M7-029

Description

Export exit plans.

Formats

JSON

CSV

Future PDF

Include

Current portfolio state

Targets

Actions

Expected result

Costs

Warnings

Assumptions

Versions

Definition of Done

Exported plans contain all data required for review.

---

# RECOMMENDATION CENTER

---

# TASK M7-031

Title

Create Recommendation Center Route

Priority

P1

Effort

S

Dependencies

M3-012

M7-001

Description

Create a page for viewing all current recommendations.

Include

Portfolio summary

Recommendation filters

Prioritized list

Recommendation details

Related actions

Definition of Done

Users can review more recommendations than the Dashboard summary displays.

---

# TASK M7-032

Title

Implement Recommendation List

Priority

P1

Effort

M

Dependencies

M7-031

Description

Display recommendations ordered by documented priority rules.

Group by

Critical

High

Medium

Informational

Filter by

Safety

Debt

Collateral

Interest

Leverage

Exit readiness

Definition of Done

Ordering is deterministic and consistent across sessions.

---

# TASK M7-033

Title

Implement Recommendation Detail Panel

Priority

P1

Effort

M

Dependencies

M7-032

Description

Display the full explanation for a selected recommendation.

Include

Triggering condition

Current values

Risk level

Suggested action

Expected effect

Assumptions

Formula IDs

Related strategy tool

Definition of Done

Every recommendation is understandable and traceable.

---

# TASK M7-034

Title

Implement Recommendation Action Links

Priority

P1

Effort

M

Dependencies

M7-033

Description

Connect recommendations to relevant planning workflows.

Examples

Reduce debt

Open Exit Planner with target inputs.

Add collateral

Open Simulation Workspace with an action scenario.

Review leverage

Open Loop Builder or leverage details.

Update stale data

Open price or protocol controls.

Requirements

Actions prefill planning tools but never modify the live portfolio.

Definition of Done

Users can investigate a recommendation without re-entering known data.

---

# TASK M7-035

Title

Implement Recommendation Acknowledgement

Priority

P3

Effort

S

Dependencies

M7-032

Description

Allow users to acknowledge informational recommendations where documented.

Requirements

Acknowledgement must not hide critical risk changes permanently.

A recommendation must return if its triggering condition materially changes.

Definition of Done

Acknowledgement behavior does not undermine financial safety warnings.

---

# TASK M7-036

Title

Implement Recommendation Recalculation

Priority

P0

Effort

M

Dependencies

M7-032

Description

Refresh recommendations when relevant portfolio inputs change.

Triggers

Market price update

Portfolio position update

Protocol parameter update

Interest-rate update

Active portfolio switch

Requirements

Avoid unnecessary duplicate calculations.

Definition of Done

Displayed recommendations always correspond to the current calculated portfolio state.

---

# STRATEGY TOOL QUALITY

---

# TASK M7-037

Title

Implement Strategy Loading and Empty States

Priority

P1

Effort

S

Dependencies

M7-006

M7-019

M7-031

Description

Create loading and empty states for all strategy tools.

Include

No active portfolio

Missing collateral

No debt

Missing prices

Missing protocol parameters

No saved strategies

No current recommendations

Definition of Done

Every state explains the requirement and provides a clear next action.

---

# TASK M7-038

Title

Implement Strategy Error Recovery

Priority

P0

Effort

M

Dependencies

M3-003

M7-010

M7-023

M7-036

Description

Handle calculation, validation, provider, and persistence failures.

Include

Retry

Restore last valid result

Return to portfolio

Edit assumptions

Export recovery copy where applicable

Definition of Done

A failed strategy calculation never destroys valid portfolio or saved-plan data.

---

# TASK M7-039

Title

Implement Responsive Strategy Layouts

Priority

P0

Effort

L

Dependencies

M7-018

M7-030

M7-036

Description

Optimize Loop Builder, Exit Planner, and Recommendation Center for desktop, tablet, and mobile.

Requirements

Critical summary appears before detailed tables.

Step tables adapt to small screens.

Forms remain usable without horizontal scrolling.

Comparison information preserves hierarchy.

Definition of Done

All strategy workflows remain functional on supported screen sizes.

---

# TASK M7-040

Title

Complete Strategy Accessibility Pass

Priority

P0

Effort

M

Dependencies

M7-039

Description

Review all strategy tools for accessibility.

Verify

Form labels

Keyboard navigation

Focus management

Warnings

Tables

Expandable details

Status announcements

Color-independent risk communication

Definition of Done

Strategy tools meet the accessibility standards in the Build Guide.

---

# TASK M7-041

Title

Create Loop Builder Tests

Priority

P0

Effort

L

Dependencies

M7-018

Description

Test Loop Builder components, state, and workflows.

Cover

Valid strategy

Unsafe strategy

Borrowing-capacity limit

Minimum Health Factor stop

Cost calculations

Stress scenario

Save and reload

Export

Definition of Done

Critical Loop Builder behavior is covered by unit, integration, and end-to-end tests.

---

# TASK M7-042

Title

Create Exit Planner Tests

Priority

P0

Effort

L

Dependencies

M7-030

Description

Test Exit Planner components, state, and workflows.

Cover

Full exit

Partial exit

Target Health Factor

Target retained BTC

Infeasible target

Price sensitivity

Save and reload

Export

Definition of Done

Critical Exit Planner behavior is covered by unit, integration, and end-to-end tests.

---

# TASK M7-043

Title

Create Recommendation Center Tests

Priority

P0

Effort

M

Dependencies

M7-036

Description

Test recommendation behavior.

Cover

Priority ordering

Category filters

Trigger explanations

Action links

Portfolio recalculation

Critical warning persistence

Definition of Done

Recommendations remain deterministic and traceable in automated tests.

---

# TASK M7-044

Title

Create Cross-Tool Workflow Tests

Priority

P0

Effort

L

Dependencies

M7-041

M7-042

M7-043

Description

Create Playwright tests covering connected strategy workflows.

Flows

Open a Dashboard recommendation and create an exit plan.

Build a loop and stress-test it in Simulation Workspace.

Copy an exit plan into a simulation.

Switch portfolios and verify strategy isolation.

Reload a saved strategy.

Definition of Done

Data and assumptions transfer correctly without modifying live portfolios.

---

# TASK M7-045

Title

Validate Strategy Tools Against UI Specification

Priority

P0

Effort

M

Dependencies

M7-044

Description

Audit all strategy tools against `03_UI.md`.

Verify

Information hierarchy

Terminology

Required inputs

Required outputs

Warnings

Assumptions

Responsive behavior

Accessibility

Definition of Done

No undocumented UI deviations remain without explicit approval.

---

# MILESTONE ACCEPTANCE CRITERIA

✓ Loop Builder is implemented.

✓ Loop calculations are shown step by step.

✓ Loop costs and risks are transparent.

✓ Loop strategies can be stress-tested.

✓ Exit Planner supports full and partial exits.

✓ Target-based exits are supported.

✓ Infeasible exit targets are explained.

✓ Recommendation Center is implemented.

✓ Recommendations are deterministic and traceable.

✓ Strategy actions never mutate the active portfolio automatically.

✓ Strategy assumptions and warnings are visible.

✓ Saving and export are supported.

✓ Responsive and accessible layouts are complete.

✓ Strategy workflow tests pass.

---

# MILESTONE DEFINITION OF DONE

Milestone 7 is complete when users can evaluate a potential leverage strategy, prepare a full or partial exit, and understand prioritized portfolio recommendations without executing any transaction or altering the active portfolio.

Every strategy must be

Deterministic

Explainable

Reproducible

Cost-aware

Risk-aware

Based on documented Formula Engine results

The tools should help users make informed decisions rather than encourage additional leverage or trading activity.

---

END OF PAGE 7

NEXT

Page 8

Milestone 8 — Persistence, Authentication, Cloud Synchronization & Import/Export

# 06_TASKS

Project

ProfitPilot

Page

8 of 10

Title

Milestone 8 — Persistence, Authentication, Cloud Synchronization & Import/Export

Version

1.0

Dependencies

README.md

01_PRD.md

03_UI.md

04_BUILD_GUIDE.md

Milestones 1–7

---

# MILESTONE OBJECTIVE

Implement reliable persistence and data portability for ProfitPilot.

Version 1 must work without an account by storing data locally in the browser.

Authentication and cloud synchronization should remain optional enhancements.

Users must retain ownership of their portfolio data and be able to export, import, back up, and recover their work.

Persistence must never alter Formula Engine behavior.

---

# STORAGE PRINCIPLES

ProfitPilot should support three persistence levels.

Local Storage

Default for all users.

Cloud Storage

Optional for authenticated users.

Export Files

Portable backups owned by the user.

The application must remain fully usable when

The user is signed out.

The network is unavailable.

Supabase is unavailable.

External data providers fail.

Cloud synchronization is disabled.

---

# DELIVERABLES

✓ Persistence architecture implemented

✓ Local portfolio storage implemented

✓ Local strategy storage implemented

✓ Storage versioning implemented

✓ Authentication implemented

✓ Supabase database schema implemented

✓ Cloud synchronization implemented

✓ Conflict handling implemented

✓ Offline behavior implemented

✓ JSON export implemented

✓ JSON import implemented

✓ CSV export implemented

✓ Backup and restore workflows implemented

✓ Privacy and security review completed

✓ Persistence tests completed

---

# IMPLEMENTATION ORDER

Persistence Foundation

↓

Local Storage

↓

Authentication

↓

Cloud Database

↓

Synchronization

↓

Import and Export

↓

Backup and Recovery

↓

Security Review

↓

Testing

Local persistence must be complete before cloud synchronization begins.

---

# PERSISTENCE FOUNDATION

---

# TASK M8-001

Title

Create Persistence Architecture

Priority

P0

Effort

M

Dependencies

M3-001

Description

Create the persistence-layer structure defined in the Build Guide.

Suggested structure

```text
services/persistence/
├── adapters/
│   ├── local-storage.adapter.ts
│   ├── supabase.adapter.ts
│   └── memory.adapter.ts
├── migrations/
├── schemas/
├── types/
├── persistence.service.ts
├── sync.service.ts
└── index.ts
```

Definition of Done

Application features access persistence through typed adapters rather than browser or Supabase APIs directly.

---

# TASK M8-002

Title

Create Persisted Data Models

Priority

P0

Effort

M

Dependencies

M8-001

Description

Define the persisted models for Version 1.

Include

User preferences

Portfolios

Collateral positions

Debt positions

Market assumptions

Protocol assumptions

Simulations

Loop strategies

Exit plans

Recommendation acknowledgements

Sync metadata

Application metadata

Requirements

Persisted models must be separate from Engine and UI models.

Definition of Done

Every persisted entity has a documented schema and version.

---

# TASK M8-003

Title

Create Storage Envelope

Priority

P0

Effort

S

Dependencies

M8-002

Description

Create a standard envelope for stored and exported data.

Include

Application name

Storage schema version

Application version

Created timestamp

Updated timestamp

Record type

Record ID

Payload

Checksum where appropriate

Definition of Done

Stored records can be validated and migrated predictably.

---

# TASK M8-004

Title

Implement Storage Schema Versioning

Priority

P0

Effort

M

Dependencies

M8-003

Description

Implement version identifiers for all persisted data.

Requirements

Every stored record includes a schema version.

Unsupported future versions are rejected safely.

Older supported versions can be migrated.

Version changes are documented.

Definition of Done

The application never assumes that stored data matches the latest schema.

---

# TASK M8-005

Title

Implement Persistence Validation

Priority

P0

Effort

M

Dependencies

M8-002

M8-003

Description

Create Zod schemas for persisted and imported records.

Validate

Envelope structure

Schema version

Identifiers

Timestamps

Portfolio data

Strategy data

Settings

Metadata

Definition of Done

Invalid persisted data cannot enter application state silently.

---

# LOCAL STORAGE

---

# TASK M8-006

Title

Implement Local Storage Adapter

Priority

P0

Effort

L

Dependencies

M8-001

M8-005

Description

Create the browser Local Storage adapter.

Support

Read record

Write record

Delete record

List records

Bulk write

Clear application data

Storage availability detection

Definition of Done

The adapter handles malformed data, unavailable storage, and quota errors safely.

---

# TASK M8-007

Title

Define Local Storage Keys

Priority

P0

Effort

S

Dependencies

M8-006

Description

Create centralized namespaced storage keys.

Include

Application metadata

Portfolios

Active portfolio

Simulations

Loop strategies

Exit plans

Preferences

Sync state

Requirements

No feature should define storage keys independently.

Definition of Done

All keys use a consistent ProfitPilot namespace and version convention.

---

# TASK M8-008

Title

Implement Local Portfolio Persistence

Priority

P0

Effort

L

Dependencies

M4-003

M8-006

Description

Persist portfolio-management data locally.

Support

Create

Update

Auto-save

Duplicate

Archive

Delete

Active portfolio selection

Definition of Done

Portfolios remain available after browser refresh and application restart.

---

# TASK M8-009

Title

Implement Local Strategy Persistence

Priority

P1

Effort

L

Dependencies

M6-015

M7-017

M7-029

M8-006

Description

Persist locally

Saved simulations

Loop strategies

Exit plans

Recommendation acknowledgements

Definition of Done

Saved analytical work remains accessible without authentication.

---

# TASK M8-010

Title

Implement Local Preference Persistence

Priority

P1

Effort

M

Dependencies

M8-006

Description

Persist user preferences.

Include

Developer Mode

Display currency

Number formatting

Default safety targets

Data source preferences

Theme preference where supported

Definition of Done

Preferences are restored without affecting financial data.

---

# TASK M8-011

Title

Implement Auto-Save Coordinator

Priority

P0

Effort

L

Dependencies

M4-013

M8-008

M8-009

Description

Coordinate automatic persistence across application Stores.

Requirements

Debounce rapid updates.

Reject invalid drafts.

Preserve last valid record.

Prevent stale writes.

Expose saving state.

Retry transient failures.

Definition of Done

Auto-save behavior is consistent across portfolios and saved strategy tools.

---

# TASK M8-012

Title

Implement Storage Capacity Monitoring

Priority

P2

Effort

M

Dependencies

M8-006

Description

Detect and communicate local storage capacity problems.

Include

Quota errors

Unavailable storage

Private browsing limitations where detectable

Large record warnings

Suggested export action

Definition of Done

Users receive a recoverable path before local changes are lost.

---

# TASK M8-013

Title

Implement Local Data Migration Runner

Priority

P0

Effort

L

Dependencies

M8-004

M8-006

Description

Create a migration process for older local schemas.

Requirements

Detect stored version.

Back up original data.

Apply ordered migrations.

Validate migrated output.

Restore original data on failure.

Record migration result.

Definition of Done

Supported older data upgrades automatically without silent loss.

---

# AUTHENTICATION

---

# TASK M8-014

Title

Configure Supabase Client

Priority

P1

Effort

M

Dependencies

M1-007

Description

Configure the Supabase client using environment variables.

Requirements

No service-role key in the browser.

Typed configuration.

Graceful behavior when cloud configuration is absent.

Secure session handling.

Definition of Done

The application can run in local-only mode when Supabase is not configured.

---

# TASK M8-015

Title

Implement Authentication Service

Priority

P1

Effort

L

Dependencies

M8-014

Description

Create a typed Authentication Service.

Support

Sign up with email and password

Sign in

Sign out

Session refresh

Password reset request

Authentication state

Authentication errors

Definition of Done

UI components do not call Supabase authentication APIs directly.

---

# TASK M8-016

Title

Implement Authentication Store

Priority

P1

Effort

M

Dependencies

M8-015

Description

Create authentication state management.

Store

Current user

Session status

Loading status

Authentication error

Cloud-sync eligibility

Definition of Done

Authentication state remains separate from portfolio data.

---

# TASK M8-017

Title

Create Sign-Up Flow

Priority

P1

Effort

M

Dependencies

M8-015

M8-016

Description

Create the optional account registration flow.

Collect

Email

Password

Password confirmation

Consent acknowledgements where required

Requirements

Explain that an account is optional.

Explain the purpose of cloud synchronization.

Definition of Done

Users can create an account without losing existing local data.

---

# TASK M8-018

Title

Create Sign-In Flow

Priority

P1

Effort

M

Dependencies

M8-015

M8-016

Description

Create the sign-in flow.

Include

Email

Password

Forgot-password action

Error handling

Local-data notice

Definition of Done

Successful sign-in preserves local data until synchronization choices are resolved.

---

# TASK M8-019

Title

Create Password Reset Flow

Priority

P2

Effort

M

Dependencies

M8-015

Description

Implement password reset request and completion states.

Definition of Done

Users receive clear success, expiration, and failure messages.

---

# TASK M8-020

Title

Implement Sign-Out Behavior

Priority

P1

Effort

S

Dependencies

M8-016

Description

Define safe sign-out behavior.

Requirements

End cloud session.

Stop cloud synchronization.

Retain or remove local cached data according to user choice.

Do not delete cloud records.

Definition of Done

Signing out never causes unrequested data loss.

---

# TASK M8-021

Title

Implement Optional Authentication Messaging

Priority

P1

Effort

S

Dependencies

M8-017

M8-018

Description

Explain the difference between local and cloud modes.

Communicate

Accounts are optional.

Local data stays on the device.

Cloud synchronization requires an account.

Export works in both modes.

Definition of Done

Users can make an informed choice without dark patterns.

---

# CLOUD DATABASE

---

# TASK M8-022

Title

Create Supabase Database Schema

Priority

P1

Effort

L

Dependencies

M8-002

M8-014

Description

Create cloud tables for Version 1 data.

Suggested tables

Profiles

Portfolios

Simulations

Loop strategies

Exit plans

User preferences

Sync metadata

Requirements

Use stable UUIDs.

Include ownership fields.

Include schema versions.

Include created and updated timestamps.

Definition of Done

Database schema supports all synchronized Version 1 entities.

---

# TASK M8-023

Title

Implement Row-Level Security

Priority

P0

Effort

L

Dependencies

M8-022

Description

Create and test Row-Level Security policies.

Requirements

Users can only read their own records.

Users can only create records they own.

Users can only update their own records.

Users can only delete their own records.

Unauthenticated access is denied.

Definition of Done

Cross-user data access tests fail as expected.

---

# TASK M8-024

Title

Generate and Validate Database Types

Priority

P1

Effort

M

Dependencies

M8-022

Description

Generate TypeScript database types and integrate them into the Supabase adapter.

Requirements

Avoid handwritten assumptions about table shapes.

Validate database responses before mapping them into application models.

Definition of Done

Cloud persistence code uses current generated database types.

---

# TASK M8-025

Title

Implement Supabase Persistence Adapter

Priority

P1

Effort

L

Dependencies

M8-022

M8-023

M8-024

Description

Implement cloud CRUD operations through the persistence adapter interface.

Support

Create

Read

Update

Delete

List

Batch synchronization

Ownership validation

Definition of Done

Application Services can switch between local and cloud adapters without changing feature code.

---

# CLOUD SYNCHRONIZATION

---

# TASK M8-026

Title

Create Synchronization Model

Priority

P1

Effort

L

Dependencies

M8-003

M8-025

Description

Define synchronization metadata.

Include

Record ID

Local updated timestamp

Cloud updated timestamp

Last synchronized timestamp

Sync status

Origin device ID

Deletion marker

Conflict status

Definition of Done

Each synchronized record has enough metadata for deterministic conflict handling.

---

# TASK M8-027

Title

Implement First Sign-In Data Merge

Priority

P0

Effort

XL

Dependencies

M8-008

M8-009

M8-025

M8-026

Description

Handle the first synchronization after sign-in.

Possible states

Local data only

Cloud data only

Both local and cloud data

No data

Requirements

Never overwrite data automatically when both sources contain meaningful records.

Show a merge summary.

Allow review before destructive replacement.

Definition of Done

Signing in cannot silently erase local or cloud work.

---

# TASK M8-028

Title

Implement Cloud Upload

Priority

P1

Effort

L

Dependencies

M8-027

Description

Upload validated local records to Supabase.

Requirements

Preserve stable IDs.

Preserve timestamps where appropriate.

Mark successful sync state.

Retry transient failures.

Prevent duplicate records.

Definition of Done

Local records appear in the authenticated user's cloud account once.

---

# TASK M8-029

Title

Implement Cloud Download

Priority

P1

Effort

L

Dependencies

M8-027

Description

Download cloud records to local storage.

Requirements

Validate all records.

Run supported migrations.

Avoid replacing newer local records without conflict handling.

Keep a local recovery backup.

Definition of Done

Cloud records can restore a new or cleared browser safely.

---

# TASK M8-030

Title

Implement Incremental Synchronization

Priority

P1

Effort

XL

Dependencies

M8-028

M8-029

Description

Synchronize records changed since the last successful sync.

Requirements

Upload local changes.

Download cloud changes.

Handle deletions.

Avoid full replacement where unnecessary.

Update sync metadata.

Preserve last valid data after failures.

Definition of Done

Routine synchronization transfers only relevant changes and remains idempotent.

---

# TASK M8-031

Title

Implement Conflict Detection

Priority

P0

Effort

L

Dependencies

M8-026

M8-030

Description

Detect when the same record changed locally and remotely after the last sync.

Conflict examples

Portfolio edited on two devices

Strategy renamed in two locations

Record deleted remotely but edited locally

Definition of Done

Conflicts are never resolved silently when user data could be lost.

---

# TASK M8-032

Title

Implement Conflict Resolution UI

Priority

P1

Effort

L

Dependencies

M8-031

Description

Allow users to resolve synchronization conflicts.

Options

Keep local version

Keep cloud version

Keep both as separate copies

Review differences

Requirements

Explain timestamps and devices where available.

Create a recovery copy before resolution.

Definition of Done

Users can resolve conflicts without understanding database internals.

---

# TASK M8-033

Title

Implement Offline Synchronization Queue

Priority

P1

Effort

L

Dependencies

M8-030

Description

Queue cloud operations while offline.

Requirements

Continue saving locally.

Record pending operations.

Retry after connectivity returns.

Preserve operation order where required.

Avoid duplicate writes.

Definition of Done

Cloud-enabled users can continue working offline safely.

---

# TASK M8-034

Title

Implement Synchronization Status

Priority

P1

Effort

M

Dependencies

M8-030

M8-033

Description

Display synchronization state.

States

Local only

Synced

Syncing

Offline

Pending changes

Conflict

Failed

Requirements

Provide useful next actions.

Do not imply that unsynchronized local work is lost.

Definition of Done

Users can always identify the storage status of their current work.

---

# TASK M8-035

Title

Implement Manual Synchronization

Priority

P2

Effort

S

Dependencies

M8-034

Description

Allow authenticated users to request synchronization manually.

Definition of Done

Manual sync follows the same validation and conflict rules as automatic synchronization.

---

# IMPORT AND EXPORT

---

# TASK M8-036

Title

Create Export Service

Priority

P0

Effort

M

Dependencies

M8-003

M8-005

Description

Create the centralized Export Service.

Support export of

All application data

Single portfolio

Simulation

Loop strategy

Exit plan

User preferences where appropriate

Definition of Done

Feature components do not create export files directly.

---

# TASK M8-037

Title

Implement Full JSON Export

Priority

P0

Effort

L

Dependencies

M8-036

Description

Export a complete portable backup.

Include

Storage envelope

All portfolios

Saved simulations

Loop strategies

Exit plans

Preferences

Versions

Timestamps

Requirements

Exclude authentication tokens.

Exclude provider secrets.

Exclude internal Supabase session data.

Definition of Done

The exported file can recreate the user's supported application data.

---

# TASK M8-038

Title

Implement Single-Record JSON Export

Priority

P1

Effort

M

Dependencies

M8-036

Description

Allow exporting one portfolio or saved strategy.

Definition of Done

Single-record exports include all dependencies required to understand and reproduce the record.

---

# TASK M8-039

Title

Implement CSV Export

Priority

P1

Effort

L

Dependencies

M8-036

Description

Provide CSV exports for tabular analysis.

Support

Portfolio positions

Scenario comparisons

Loop steps

Exit plan breakdowns

Requirements

Use stable column names.

Include units.

Include timestamps and identifiers.

Definition of Done

CSV files open cleanly in common spreadsheet applications.

---

# TASK M8-040

Title

Create Import Service

Priority

P0

Effort

M

Dependencies

M8-005

Description

Create the centralized Import Service.

Responsibilities

Read file

Parse content

Validate envelope

Check version

Run supported migrations

Create preview

Apply approved import

Return warnings and errors

Definition of Done

Feature components do not write imported data directly to Stores or persistence.

---

# TASK M8-041

Title

Implement JSON Import Validation

Priority

P0

Effort

L

Dependencies

M8-040

Description

Validate imported JSON before any data is changed.

Check

File format

Application identifier

Schema version

Required records

Identifiers

Data types

Duplicate IDs

Unsupported assets

Corrupted values

Definition of Done

Invalid imports leave existing application data unchanged.

---

# TASK M8-042

Title

Implement Import Preview

Priority

P0

Effort

L

Dependencies

M8-041

Description

Show a summary before applying imported data.

Display

File version

Export date

Portfolio count

Strategy counts

Conflicts

Warnings

Unsupported records

Proposed actions

Definition of Done

Users understand what will change before confirming import.

---

# TASK M8-043

Title

Implement Import Merge Options

Priority

P0

Effort

XL

Dependencies

M8-042

Description

Support controlled import modes.

Options

Add as new records

Merge non-conflicting records

Replace selected records

Replace all local application data

Requirements

Replacement requires explicit confirmation.

Create a recovery backup first.

Never replace authenticated cloud data automatically.

Definition of Done

Imports preserve existing data unless the user explicitly approves replacement.

---

# TASK M8-044

Title

Implement Import Rollback

Priority

P0

Effort

L

Dependencies

M8-043

Description

Restore the pre-import state when an import fails during application.

Requirements

Create transactional backup.

Validate final state.

Rollback on any critical failure.

Report partial unsupported records without corrupting valid data.

Definition of Done

A failed import cannot leave persistence in an inconsistent state.

---

# TASK M8-045

Title

Implement Export File Naming

Priority

P2

Effort

XS

Dependencies

M8-037

Description

Create readable export filenames.

Include

ProfitPilot

Record type

Portfolio or strategy name where appropriate

Date

Schema version

Definition of Done

Export files are identifiable without opening them.

---

# BACKUP AND RECOVERY

---

# TASK M8-046

Title

Implement Automatic Local Recovery Snapshot

Priority

P1

Effort

M

Dependencies

M8-011

Description

Maintain a limited local recovery snapshot.

Create before

Major migration

Large import

Full replacement

Conflict resolution

Bulk deletion

Requirements

Limit retained snapshots.

Avoid excessive storage use.

Definition of Done

Recent valid data can be restored after high-risk persistence operations.

---

# TASK M8-047

Title

Create Backup and Restore Settings

Priority

P1

Effort

M

Dependencies

M8-037

M8-042

M8-046

Description

Create a Settings section for data management.

Include

Export all data

Import backup

View storage mode

View sync state

Restore recovery snapshot

Clear local data

Definition of Done

Users can manage their data without developer tools.

---

# TASK M8-048

Title

Implement Clear Local Data Workflow

Priority

P0

Effort

M

Dependencies

M8-047

Description

Allow users to remove locally stored ProfitPilot data.

Requirements

Explain what will be deleted.

Explain what cloud data will remain.

Require explicit confirmation.

Offer export first.

End with a clean valid application state.

Definition of Done

Users can safely reset the local application.

---

# TASK M8-049

Title

Implement Cloud Data Deletion Workflow

Priority

P1

Effort

L

Dependencies

M8-025

M8-047

Description

Allow authenticated users to delete cloud-stored ProfitPilot records.

Requirements

Separate from sign-out.

Explain consequences.

Offer export first.

Require reauthentication where appropriate.

Confirm completion.

Definition of Done

Cloud deletion is intentional, auditable, and does not imply account deletion unless explicitly selected.

---

# TASK M8-050

Title

Document Disaster Recovery Procedure

Priority

P1

Effort

M

Dependencies

M8-013

M8-044

M8-046

Description

Document recovery steps for

Malformed local storage

Failed migration

Failed import

Sync conflict

Unavailable Supabase

Deleted local browser data

Unsupported future schema

Definition of Done

Developers and users have a documented recovery path for supported failure modes.

---

# PRIVACY AND SECURITY

---

# TASK M8-051

Title

Implement Sensitive Data Exclusion Rules

Priority

P0

Effort

M

Dependencies

M8-036

M8-040

Description

Create explicit rules preventing storage or export of sensitive credentials.

Never store

Private keys

Seed phrases

Wallet signing secrets

Exchange credentials

Supabase service-role keys

Provider secrets

Authentication tokens in exports

Definition of Done

Automated tests verify prohibited fields are not persisted or exported.

---

# TASK M8-052

Title

Implement Data Sanitization

Priority

P0

Effort

M

Dependencies

M8-005

Description

Sanitize user-controlled text before display or storage where appropriate.

Apply to

Portfolio names

Descriptions

Scenario names

Strategy names

Imported metadata

Definition of Done

Stored text cannot create unsafe rendered output.

---

# TASK M8-053

Title

Implement Secure Session Review

Priority

P0

Effort

M

Dependencies

M8-015

Description

Review authentication and session behavior.

Verify

Secure token handling

Session expiration

Sign-out cleanup

Password reset flow

No session data in exports

No authenticated API access after sign-out

Definition of Done

Authentication behavior passes the security checklist in the Build Guide.

---

# TASK M8-054

Title

Complete Persistence Threat Review

Priority

P0

Effort

L

Dependencies

M8-023

M8-031

M8-043

M8-051

Description

Review persistence threats.

Include

Cross-user access

Malicious imports

Corrupted local storage

Replay or duplicate sync operations

Accidental overwrite

Unauthorized cloud deletion

Sensitive data leakage

Definition of Done

Critical findings are resolved or explicitly documented before release.

---

# QUALITY AND TESTING

---

# TASK M8-055

Title

Create Local Persistence Tests

Priority

P0

Effort

L

Dependencies

M8-013

Description

Test Local Storage behavior.

Cover

Create

Read

Update

Delete

Auto-save

Malformed records

Quota failures

Unavailable storage

Migration success

Migration rollback

Definition of Done

Local persistence works without network or authentication.

---

# TASK M8-056

Title

Create Authentication Tests

Priority

P0

Effort

L

Dependencies

M8-020

Description

Test authentication flows.

Cover

Sign up

Sign in

Invalid credentials

Session restoration

Password reset

Sign out

Local-data preservation

Definition of Done

Authentication behavior is reliable and does not affect local data unexpectedly.

---

# TASK M8-057

Title

Create Row-Level Security Tests

Priority

P0

Effort

L

Dependencies

M8-023

Description

Verify database ownership enforcement.

Cover

Own record read

Own record write

Own record delete

Other-user read denial

Other-user update denial

Unauthenticated denial

Definition of Done

No tested path permits cross-user data access.

---

# TASK M8-058

Title

Create Synchronization Tests

Priority

P0

Effort

XL

Dependencies

M8-035

Description

Test synchronization scenarios.

Cover

Local-only first sign-in

Cloud-only first sign-in

Both sources populated

Offline edits

Retry after reconnect

Concurrent edits

Deletion conflict

Keep-local resolution

Keep-cloud resolution

Keep-both resolution

Definition of Done

Synchronization is deterministic and preserves recoverable copies during conflicts.

---

# TASK M8-059

Title

Create Import and Export Tests

Priority

P0

Effort

XL

Dependencies

M8-045

M8-044

Description

Test data portability.

Cover

Full export

Single portfolio export

Strategy export

Valid import

Old supported version

Unsupported future version

Malformed file

Duplicate IDs

Merge import

Replace import

Rollback after failure

Definition of Done

Valid exports are reproducible and invalid imports do not change existing data.

---

# TASK M8-060

Title

Create Offline End-to-End Tests

Priority

P0

Effort

L

Dependencies

M8-033

M8-055

Description

Create Playwright workflows for offline use.

Cover

Open existing portfolio offline

Edit portfolio offline

Save simulation offline

Queue cloud changes

Reconnect

Synchronize successfully

Definition of Done

Core Version 1 workflows remain functional without network access.

---

# TASK M8-061

Title

Create Persistence End-to-End Tests

Priority

P0

Effort

XL

Dependencies

M8-056

M8-058

M8-059

Description

Create complete persistence workflows.

Flows

Create local portfolio and refresh browser.

Export and restore application data.

Sign up with existing local data.

Merge local and cloud records.

Edit on two simulated clients and resolve conflict.

Sign out while retaining local data.

Clear local data without deleting cloud data.

Definition of Done

Critical storage and account workflows pass in supported browsers.

---

# TASK M8-062

Title

Validate Persistence Against Build Guide

Priority

P0

Effort

M

Dependencies

M8-061

Description

Perform a final audit against the persistence, authentication, privacy, and recovery requirements in `04_BUILD_GUIDE.md`.

Verify

Local-first operation

Optional authentication

Optional cloud synchronization

Import validation

Export portability

Version compatibility

Conflict handling

Offline support

Security rules

Recovery behavior

Definition of Done

No undocumented deviations remain without explicit approval.

---

# MILESTONE ACCEPTANCE CRITERIA

✓ ProfitPilot works without authentication.

✓ Local storage is the default persistence mode.

✓ Portfolios and saved strategies survive browser refresh.

✓ Stored data is validated and versioned.

✓ Supported older schemas migrate safely.

✓ Authentication is optional.

✓ Existing local data survives sign-in.

✓ Cloud data is protected by Row-Level Security.

✓ Synchronization supports offline work.

✓ Conflicts are never resolved silently.

✓ JSON export and import are complete.

✓ CSV export is available for tabular data.

✓ Invalid imports do not change existing data.

✓ Recovery snapshots protect high-risk operations.

✓ Private keys and credentials are never stored.

✓ Persistence and synchronization tests pass.

---

# MILESTONE DEFINITION OF DONE

Milestone 8 is complete when ProfitPilot provides reliable local-first persistence, optional account-based cloud synchronization, and user-controlled data portability.

A user must be able to

Use the application without an account

Save work locally

Refresh or reopen the application without losing data

Export a complete backup

Import and review a backup safely

Sign in without losing local work

Use the application offline

Synchronize across devices

Resolve data conflicts explicitly

Delete local or cloud data intentionally

At no point may authentication, synchronization, import, or export change financial calculation behavior or silently destroy valid user data.

---

END OF PAGE 8

NEXT

Page 9

Milestone 9 — Quality, Accessibility, Security, Performance & Release Hardening

# 06_TASKS

Project

ProfitPilot

Page

9 of 10

Title

Milestone 9 — Quality, Accessibility, Security, Performance & Release Hardening

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

05_AI_PROMPTS.md

Milestones 1–8

---

# MILESTONE OBJECTIVE

Prepare ProfitPilot for a stable Version 1 release.

This milestone focuses on application-wide quality rather than introducing major new product features.

The objective is to verify that ProfitPilot is

Correct

Accessible

Secure

Responsive

Performant

Recoverable

Observable

Documented

Production-ready

All critical workflows must be tested under normal, boundary, failure, offline, and recovery conditions.

---

# RELEASE HARDENING PRINCIPLES

Correctness before convenience.

Safety before speed.

Recovery before destructive failure.

Measured performance before optimization.

Accessible interaction before visual polish.

Explicit assumptions before simplified outputs.

No known P0 defect may remain open at release.

No known critical security issue may remain unresolved.

No financial Formula ID may ship without automated coverage.

---

# DELIVERABLES

✓ Quality assurance plan completed

✓ Formula coverage audit completed

✓ Unit test suite completed

✓ Integration test suite completed

✓ End-to-end suite completed

✓ Cross-browser review completed

✓ Accessibility audit completed

✓ Security review completed

✓ Performance review completed

✓ Error handling audit completed

✓ Data recovery review completed

✓ Observability implemented

✓ Production configuration validated

✓ Release candidate tested

✓ Version 1 sign-off completed

---

# IMPLEMENTATION ORDER

Quality Baseline

↓

Formula and Service Verification

↓

Application Workflow Testing

↓

Accessibility Hardening

↓

Security Hardening

↓

Performance Optimization

↓

Reliability and Recovery

↓

Observability

↓

Release Candidate Validation

Testing should occur continuously throughout the project.

This milestone completes the final application-wide verification.

---

# QUALITY FOUNDATION

---

# TASK M9-001

Title

Create Version 1 Quality Plan

Priority

P0

Effort

M

Dependencies

Milestones 1–8

Description

Create a formal quality plan for Version 1.

Define

Critical user workflows

Critical financial calculations

Supported browsers

Supported viewport sizes

Supported persistence modes

Release-blocking defect categories

Test ownership

Review responsibilities

Sign-off requirements

Definition of Done

The team has one documented standard for deciding whether Version 1 is releasable.

---

# TASK M9-002

Title

Create Requirements Traceability Matrix

Priority

P0

Effort

L

Dependencies

M9-001

Description

Map documented requirements to implementation and tests.

Include

PRD requirement

Formula ID where applicable

UI requirement

Implementation module

Test location

Current status

Known limitation

Definition of Done

Every Version 1 requirement is implemented, deferred explicitly, or rejected with documented approval.

---

# TASK M9-003

Title

Audit Definition of Done Compliance

Priority

P0

Effort

M

Dependencies

M9-002

Description

Review completed milestone tasks against their Definitions of Done.

Verify

Implementation exists.

Tests exist.

Documentation is current.

Error states are covered.

Accessibility is considered.

No unresolved dependency remains.

Definition of Done

No task is marked complete without satisfying its documented completion criteria.

---

# TASK M9-004

Title

Create Release Defect Classification

Priority

P0

Effort

S

Dependencies

M9-001

Description

Define defect severity.

P0

Data loss, security breach, incorrect critical financial result, unusable application, or cross-user exposure.

P1

Major workflow failure, misleading high-risk output, inaccessible critical workflow, or persistent synchronization failure.

P2

Significant but recoverable defect with a documented workaround.

P3

Minor visual, wording, or low-impact usability issue.

Definition of Done

Every open defect has a severity, owner, status, and release decision.

---

# FORMULA ENGINE VERIFICATION

---

# TASK M9-005

Title

Complete Formula Coverage Audit

Priority

P0

Effort

L

Dependencies

M2-032

M9-002

Description

Verify every Version 1 Formula ID.

For each Formula ID confirm

Canonical documentation exists.

One implementation exists.

Normal-case tests exist.

Boundary tests exist where relevant.

Invalid-input tests exist.

Golden Reference coverage exists for critical formulas.

Public output includes the Formula ID.

Definition of Done

No Version 1 Formula ID remains unimplemented or untested.

---

# TASK M9-006

Title

Perform Independent Golden Reference Review

Priority

P0

Effort

L

Dependencies

M2-028

M9-005

Description

Recalculate critical Golden Reference portfolios independently.

Review

Portfolio value

Net equity

LTV

Health Factor

Liquidation price

Interest cost

Loop outputs

Simulation outputs

Exit outputs

Requirements

Use a separate calculation method or verified external worksheet.

Document tolerances.

Definition of Done

Critical expected results have independent verification.

---

# TASK M9-007

Title

Test Numeric Precision and Rounding

Priority

P0

Effort

M

Dependencies

M9-005

Description

Audit numeric precision across the Formula Engine, Services, persistence, exports, and UI.

Verify

Decimal arithmetic remains internal.

Serialization does not introduce material errors.

Rounding occurs only at display boundaries unless documented.

Percentages use consistent scales.

Currency and token units remain explicit.

Definition of Done

Stored and displayed values remain within documented tolerances.

---

# TASK M9-008

Title

Test Formula Boundary Conditions

Priority

P0

Effort

L

Dependencies

M9-005

Description

Test critical edge conditions.

Include

Zero debt

Zero collateral

Very small balances

Very large balances

Health Factor near one

Health Factor exactly one where valid

Zero interest

Extreme interest rate

Maximum LTV boundary

Liquidation threshold boundary

Infeasible exit target

Loop stop conditions

Definition of Done

Boundary conditions return documented values, warnings, or errors without unexpected exceptions.

---

# TASK M9-009

Title

Test Cross-Formula Invariants

Priority

P0

Effort

L

Dependencies

M2-027

M9-008

Description

Verify mathematical relationships across modules.

Examples

Net equity equals collateral minus debt.

Debt repayment reduces debt by the expected amount.

Collateral addition increases adjusted collateral consistently.

Target Health Factor outputs reproduce the target.

Full exit produces the documented remaining state.

Loop step totals reconcile with final values.

Definition of Done

All critical invariants pass across Golden Reference and generated test cases.

---

# TASK M9-010

Title

Implement Property-Based Formula Tests

Priority

P1

Effort

L

Dependencies

M9-009

Description

Create generated tests for suitable mathematical properties.

Examples

Increasing debt must not improve Health Factor when other values are fixed.

Adding eligible collateral must not reduce Health Factor.

Repaying debt must not increase LTV.

Removing fees must not worsen net proceeds.

Zero-duration interest projection must preserve starting debt.

Definition of Done

Property tests cover the most important monotonic and invariant behaviors.

---

# SERVICE AND STATE VERIFICATION

---

# TASK M9-011

Title

Audit Service Boundaries

Priority

P0

Effort

M

Dependencies

M3-014

Description

Review all Services for architectural compliance.

Verify

No duplicated formulas.

No React imports.

No direct UI formatting.

Validation occurs at boundaries.

Errors use the standard model.

Provider failures preserve valid fallback data.

Definition of Done

Services remain clean orchestration boundaries around Engine, persistence, and providers.

---

# TASK M9-012

Title

Audit State Management

Priority

P0

Effort

L

Dependencies

Milestones 4–8

Description

Review application Stores.

Verify

Portfolio state isolation

Simulation isolation

Strategy isolation

Authentication isolation

Persistence delegation

No derived financial calculations in Stores

No cross-portfolio contamination

Predictable loading and error states

Definition of Done

State transitions remain deterministic and testable.

---

# TASK M9-013

Title

Test Concurrent State Updates

Priority

P1

Effort

L

Dependencies

M9-012

Description

Test rapid and overlapping updates.

Cases

Price refresh during portfolio edit

Auto-save during portfolio switch

Sync during local edit

Simulation recalculation during input changes

Sign-out during pending cloud write

Import during stale background refresh

Definition of Done

Stale operations cannot overwrite newer valid state.

---

# TASK M9-014

Title

Test Application Restart Recovery

Priority

P0

Effort

M

Dependencies

M8-061

Description

Verify state restoration after browser refresh or application restart.

Cover

Active portfolio

Unsynchronized local changes

Saved simulations

Saved strategies

Preferences

Authentication session where valid

Pending sync queue

Definition of Done

The application restores a coherent last valid state.

---

# APPLICATION WORKFLOW TESTING

---

# TASK M9-015

Title

Define Critical End-to-End Workflows

Priority

P0

Effort

M

Dependencies

M9-001

Description

Create the final list of release-blocking workflows.

Include

Create first portfolio

Edit collateral and debt

Review Dashboard risk

Run simulation

Compare scenarios

Build loop strategy

Stress-test loop

Create exit plan

Review recommendation

Save and reload work

Export and import backup

Use application offline

Sign in and synchronize

Resolve data conflict

Definition of Done

Every critical workflow has an automated end-to-end test or an approved manual test procedure.

---

# TASK M9-016

Title

Complete Desktop End-to-End Suite

Priority

P0

Effort

XL

Dependencies

M9-015

Description

Run and stabilize all critical workflows on the primary desktop browser configuration.

Requirements

Use deterministic test fixtures.

Avoid external provider dependencies.

Capture useful failure artifacts.

Reset test state safely.

Definition of Done

All critical desktop workflows pass repeatedly without flaky behavior.

---

# TASK M9-017

Title

Complete Mobile End-to-End Suite

Priority

P0

Effort

XL

Dependencies

M9-015

Description

Test critical workflows on supported mobile viewport sizes.

Focus

Navigation

Forms

KPI readability

Tables and cards

Scenario controls

Strategy workflows

Import and export entry points

Error recovery

Definition of Done

Critical workflows remain usable without horizontal page scrolling or inaccessible controls.

---

# TASK M9-018

Title

Complete Tablet Workflow Review

Priority

P1

Effort

M

Dependencies

M9-015

Description

Review supported tablet layouts.

Definition of Done

Information hierarchy and interaction remain stable between mobile and desktop breakpoints.

---

# TASK M9-019

Title

Test Browser Navigation Behavior

Priority

P1

Effort

M

Dependencies

M9-016

Description

Test browser controls.

Include

Back

Forward

Refresh

Deep links

Direct route entry

Session restoration

Unsaved-change handling

Definition of Done

Browser navigation does not corrupt state or create unintended duplicate records.

---

# TASK M9-020

Title

Test Destructive Action Protection

Priority

P0

Effort

M

Dependencies

M9-016

Description

Verify safeguards around destructive operations.

Include

Portfolio deletion

Bulk local-data clearing

Cloud-data deletion

Import replacement

Conflict resolution

Archive behavior

Sign-out cache removal

Requirements

Use explicit confirmation.

Explain scope.

Offer export or recovery where appropriate.

Definition of Done

No destructive operation can occur through an ambiguous or accidental interaction.

---

# TASK M9-021

Title

Perform Cross-Browser Testing

Priority

P0

Effort

L

Dependencies

M9-016

M9-017

Description

Test supported browsers.

Recommended minimum

Current Chrome

Current Firefox

Current Safari

Current Edge

Review

Layout

Storage

Downloads

Forms

Charts

Authentication

Offline behavior

Definition of Done

Critical workflows function in every supported browser or limitations are documented and approved.

---

# ACCESSIBILITY HARDENING

---

# TASK M9-022

Title

Perform Automated Accessibility Audit

Priority

P0

Effort

M

Dependencies

Milestones 4–8

Description

Run automated accessibility checks across all routes.

Review

Landmarks

Labels

Heading structure

Contrast

Duplicate IDs

Accessible names

Form errors

ARIA usage

Definition of Done

No unresolved critical automated accessibility violation remains.

---

# TASK M9-023

Title

Perform Keyboard Navigation Audit

Priority

P0

Effort

L

Dependencies

M9-022

Description

Navigate all critical workflows using only the keyboard.

Verify

Logical tab order

Visible focus

Dialog focus trapping

Menu operation

Form completion

Table interaction

Expandable content

Route changes

Definition of Done

Every critical action is reachable and operable without a pointer device.

---

# TASK M9-024

Title

Perform Screen Reader Review

Priority

P0

Effort

L

Dependencies

M9-022

Description

Review critical workflows with a supported screen reader.

Verify

Page titles

Headings

Status messages

Warnings

Form errors

KPI labels

Table headers

Chart alternatives

Modal announcements

Definition of Done

Financial values and risk states are understandable without visual context.

---

# TASK M9-025

Title

Audit Color and Risk Communication

Priority

P0

Effort

M

Dependencies

M9-022

Description

Verify that no meaning relies on color alone.

Apply to

Health Factor zones

Warnings

Positive and negative comparisons

Sync state

Validation errors

Charts

Recommendations

Definition of Done

Text, symbols, labels, or patterns communicate every meaningful status.

---

# TASK M9-026

Title

Audit Form Accessibility

Priority

P0

Effort

M

Dependencies

M9-023

Description

Review all forms.

Verify

Persistent labels

Helpful descriptions

Programmatic error association

Error summaries where appropriate

Required-field identification

Input units

Keyboard-friendly controls

No inaccessible custom widgets

Definition of Done

Users can complete and correct every critical form accessibly.

---

# TASK M9-027

Title

Audit Motion and Visual Stability

Priority

P1

Effort

S

Dependencies

M9-022

Description

Review animation and layout movement.

Requirements

Respect reduced-motion preferences.

Avoid distracting metric animation.

Avoid large layout shifts.

Keep loading states stable.

Definition of Done

Motion does not interfere with comprehension or accessibility.

---

# TASK M9-028

Title

Document Accessibility Conformance

Priority

P1

Effort

M

Dependencies

M9-022 through M9-027

Description

Document the completed accessibility review.

Include

Standards targeted

Tools used

Manual workflows reviewed

Known limitations

Resolved defects

Deferred improvements

Definition of Done

Accessibility status is transparent and reviewable before release.

---

# SECURITY HARDENING

---

# TASK M9-029

Title

Perform Dependency Security Audit

Priority

P0

Effort

M

Dependencies

M1-002

Description

Audit application dependencies.

Review

Known vulnerabilities

Unmaintained packages

Unnecessary packages

Transitive risk

License concerns

Upgrade requirements

Definition of Done

Critical and high-severity dependency vulnerabilities are resolved or formally mitigated.

---

# TASK M9-030

Title

Audit Environment Variable Handling

Priority

P0

Effort

S

Dependencies

M1-007

M8-014

Description

Verify configuration safety.

Check

No secrets committed.

No service-role keys exposed.

Public variables are intentionally public.

Missing optional configuration fails gracefully.

Production and preview values are separated.

Definition of Done

Client bundles contain no prohibited secret material.

---

# TASK M9-031

Title

Audit Authentication and Authorization

Priority

P0

Effort

L

Dependencies

M8-053

M8-057

Description

Review authentication and cloud authorization.

Verify

Session expiration

Password reset

Sign-out

Row-Level Security

Ownership enforcement

Unauthenticated denial

Cross-user isolation

Revoked session behavior

Definition of Done

No user can access or modify another user's records through tested paths.

---

# TASK M9-032

Title

Audit Import Security

Priority

P0

Effort

L

Dependencies

M8-041

M8-054

Description

Review import handling for malicious or malformed files.

Test

Oversized files

Deeply nested data

Unexpected fields

Script-like text

Unsupported versions

Duplicate identifiers

Invalid numeric values

Corrupted checksums

Definition of Done

Unsafe imports are rejected without changing application data.

---

# TASK M9-033

Title

Audit Export Privacy

Priority

P0

Effort

M

Dependencies

M8-037

M8-051

Description

Verify exported files exclude

Authentication tokens

Session metadata

Provider secrets

Private keys

Seed phrases

Internal authorization fields

Unnecessary personal data

Definition of Done

Exported data contains only documented user-owned application records and metadata.

---

# TASK M9-034

Title

Perform Input and Output Sanitization Review

Priority

P0

Effort

M

Dependencies

M8-052

Description

Review user-controlled text and imported metadata.

Check

Portfolio names

Descriptions

Strategy names

Scenario names

Error messages

Export filenames

Rendered imported content

Definition of Done

User-controlled content cannot produce executable or unsafe rendered output.

---

# TASK M9-035

Title

Review Security Headers and Deployment Controls

Priority

P0

Effort

M

Dependencies

M1-009

Description

Configure and verify production security controls.

Review

Content Security Policy where practical

Frame restrictions

Content type protections

Referrer policy

HTTPS enforcement

Secure cookies

Preview deployment access where appropriate

Definition of Done

Production responses include approved security protections without breaking required functionality.

---

# TASK M9-036

Title

Complete Security Threat Model

Priority

P0

Effort

L

Dependencies

M9-029 through M9-035

Description

Document and review application threats.

Include

Financial misinformation through stale inputs

Cross-user cloud access

Data loss

Malicious imports

Session theft

Sensitive data exposure

Provider manipulation

UI spoofing

Dependency compromise

Requirements

Document mitigations and residual risk.

Definition of Done

No unresolved critical security threat remains.

---

# PERFORMANCE HARDENING

---

# TASK M9-037

Title

Establish Performance Baseline

Priority

P0

Effort

M

Dependencies

Milestones 1–8

Description

Measure application performance before optimization.

Capture

Initial page load

Dashboard render

Portfolio recalculation

Simulation calculation

Scenario comparison

Loop calculation

Import processing

Synchronization

Bundle size

Definition of Done

Baseline measurements are documented using repeatable test conditions.

---

# TASK M9-038

Title

Optimize Application Bundle

Priority

P1

Effort

L

Dependencies

M9-037

Description

Review client bundle composition.

Actions

Remove unused dependencies.

Apply route-level code splitting.

Lazy-load heavy charts.

Avoid importing server-only modules into client code.

Review icon and utility imports.

Definition of Done

Bundle improvements are measured and do not reduce correctness.

---

# TASK M9-039

Title

Optimize Rendering Behavior

Priority

P1

Effort

L

Dependencies

M9-037

Description

Reduce unnecessary UI work.

Review

Store subscriptions

Expensive formatting

Large lists

Chart rerenders

Form updates

Scenario comparison rendering

Memoization where justified

Definition of Done

Frequent edits and recalculations remain responsive on supported devices.

---

# TASK M9-040

Title

Optimize Formula and Service Execution

Priority

P1

Effort

M

Dependencies

M2-030

M9-037

Description

Review calculation performance.

Focus

Repeated portfolio summaries

Scenario batches

Loop steps

Recommendation recalculation

Serialization overhead

Requirements

Preserve Decimal precision.

Avoid caching stale financial results.

Definition of Done

Core calculations satisfy the Build Guide performance targets.

---

# TASK M9-041

Title

Optimize Persistence and Synchronization

Priority

P1

Effort

M

Dependencies

M8-030

M9-037

Description

Review data storage performance.

Improve where needed

Debounced writes

Incremental sync

Batch operations

Migration processing

Large export generation

Import validation

Definition of Done

Persistence operations do not block critical interactions unnecessarily.

---

# TASK M9-042

Title

Run Production Performance Audit

Priority

P0

Effort

M

Dependencies

M9-038 through M9-041

Description

Audit a production-like deployment.

Review

Core Web Vitals

Route transitions

Layout stability

Network requests

Caching

Large viewport and mobile behavior

Requirements

Document deviations and approved thresholds.

Definition of Done

No release-blocking performance regression remains.

---

# RELIABILITY AND ERROR HANDLING

---

# TASK M9-043

Title

Audit Application Error Boundaries

Priority

P0

Effort

M

Dependencies

Milestones 4–8

Description

Ensure unexpected component failures are contained.

Include

Application-level boundary

Feature-level boundaries where appropriate

Recovery actions

Diagnostic identifiers

Safe user messages

Definition of Done

A component failure does not force the entire application into an unrecoverable blank state.

---

# TASK M9-044

Title

Audit User-Facing Error Messages

Priority

P0

Effort

M

Dependencies

M3-003

Description

Review all significant errors.

Requirements

Explain what failed.

Explain whether data is safe.

Provide a recovery action.

Avoid internal technical details.

Avoid blaming the user.

Preserve diagnostic context for logs.

Definition of Done

Critical error messages are clear, actionable, and consistent.

---

# TASK M9-045

Title

Test Provider Failure Recovery

Priority

P0

Effort

L

Dependencies

M3-007

M3-008

Description

Simulate

Price provider unavailable

Protocol provider unavailable

Timeout

Malformed provider response

Stale data

Partial response

Requirements

Retain last valid values.

Allow manual fallback.

Display freshness warnings.

Definition of Done

Provider failures do not make local analysis unavailable.

---

# TASK M9-046

Title

Test Persistence Failure Recovery

Priority

P0

Effort

L

Dependencies

M8-055

M8-058

Description

Simulate

Local storage unavailable

Quota exceeded

Cloud unavailable

Sync timeout

Conflict

Failed migration

Failed import

Failed export

Definition of Done

Valid data remains recoverable and the user receives a clear next step.

---

# TASK M9-047

Title

Test Network Interruption

Priority

P0

Effort

M

Dependencies

M8-060

Description

Interrupt network access during

Price refresh

Authentication

Synchronization

Cloud save

Password reset

Import-related cloud workflow

Definition of Done

The application transitions safely between online and offline states.

---

# TASK M9-048

Title

Perform Data Loss Scenario Review

Priority

P0

Effort

L

Dependencies

M8-046

M9-046

Description

Review likely data-loss scenarios.

Include

Browser data cleared

Device unavailable

Failed migration

Import replacement mistake

Cloud conflict

User deletion

Corrupted local record

Requirements

Document prevention, recovery, and limitations.

Definition of Done

Every supported recovery mechanism has been tested successfully.

---

# OBSERVABILITY

---

# TASK M9-049

Title

Implement Production Error Monitoring

Priority

P1

Effort

M

Dependencies

M9-043

Description

Configure privacy-conscious production error monitoring.

Capture

Unhandled exceptions

Failed critical workflows

Route failures

Provider failures

Synchronization failures

Import and migration failures

Requirements

Do not send portfolio balances or sensitive user data unnecessarily.

Definition of Done

Critical production failures can be detected without exposing private financial information.

---

# TASK M9-050

Title

Implement Structured Diagnostic Logging

Priority

P1

Effort

M

Dependencies

M9-049

Description

Create structured diagnostic events.

Include

Event category

Error code

Application version

Engine version

Formula version where relevant

Feature

Operation

Success or failure

Sanitized context

Definition of Done

Logs support investigation without containing prohibited sensitive values.

---

# TASK M9-051

Title

Implement Release Health Metrics

Priority

P2

Effort

M

Dependencies

M9-049

Description

Track high-level reliability metrics where privacy requirements permit.

Examples

Application error rate

Failed synchronization rate

Failed import rate

Provider fallback rate

Critical workflow completion rate

Definition of Done

Release health can be evaluated without collecting unnecessary financial data.

---

# TASK M9-052

Title

Create Incident Response Procedure

Priority

P1

Effort

M

Dependencies

M9-049

Description

Document response steps for production incidents.

Include

Incorrect financial output

Data loss report

Security issue

Cloud outage

Broken import

Failed migration

Critical dependency vulnerability

Definition of Done

The team has a defined escalation, mitigation, communication, and rollback process.

---

# DOCUMENTATION HARDENING

---

# TASK M9-053

Title

Audit User Documentation

Priority

P1

Effort

M

Dependencies

Milestones 4–8

Description

Verify user-facing guidance for

Portfolio creation

Manual prices

Health Factor

Liquidation estimates

Simulations

Loop strategies

Exit planning

Local storage

Cloud synchronization

Import and export

Data deletion

Definition of Done

Critical workflows and risk concepts have understandable guidance.

---

# TASK M9-054

Title

Audit Developer Documentation

Priority

P0

Effort

L

Dependencies

M1-010

Description

Verify developer documentation.

Include

Local setup

Environment variables

Architecture

Formula workflow

Testing

Database migrations

Persistence migrations

Deployment

Release process

Incident response

Definition of Done

A new developer can build, test, and understand the project without undocumented tribal knowledge.

---

# TASK M9-055

Title

Audit In-Application Financial Disclosures

Priority

P0

Effort

M

Dependencies

M5-028

M6-026

M7-045

Description

Review risk and assumption language.

Verify

Calculations are estimates where applicable.

Manual inputs are identified.

Stale data is visible.

No guarantee language is used.

No transaction-execution claim is made.

Leverage risks are communicated.

Definition of Done

The interface does not misrepresent ProfitPilot as financial advice or an execution system.

---

# TASK M9-056

Title

Complete Changelog and Version Metadata

Priority

P1

Effort

S

Dependencies

M9-054

Description

Prepare Version 1 metadata.

Include

Application version

Engine version

Formula version

Storage schema version

Database migration version

Release date

Known limitations

Definition of Done

Version information is consistent across documentation, application metadata, and exports.

---

# RELEASE CANDIDATE

---

# TASK M9-057

Title

Create Release Candidate Build

Priority

P0

Effort

M

Dependencies

M9-005 through M9-056

Description

Create a production-like Version 1 release candidate.

Requirements

Use production build settings.

Use release database migrations.

Use approved environment configuration.

Use immutable version metadata.

Tag the candidate.

Definition of Done

The release candidate can be tested independently from active development changes.

---

# TASK M9-058

Title

Run Release Candidate Smoke Tests

Priority

P0

Effort

L

Dependencies

M9-057

Description

Run critical smoke tests against the release candidate.

Cover

Application startup

Create portfolio

Dashboard calculation

Simulation

Loop Builder

Exit Planner

Export

Import

Authentication

Synchronization

Offline fallback

Definition of Done

No critical smoke test fails.

---

# TASK M9-059

Title

Run Release Candidate Regression Suite

Priority

P0

Effort

XL

Dependencies

M9-057

Description

Run

Formula tests

Service tests

Component tests

Integration tests

End-to-end tests

Accessibility checks

Security checks

Migration tests

Import/export tests

Definition of Done

The full approved regression suite passes on the release candidate.

---

# TASK M9-060

Title

Perform Manual Exploratory Testing

Priority

P0

Effort

L

Dependencies

M9-057

Description

Perform unscripted testing using realistic portfolios and workflows.

Explore

Unexpected navigation

Rapid input changes

Unusual numeric values

Interrupted workflows

Conflicting actions

Long names and descriptions

Empty and partial data

Multiple portfolios

Multiple saved strategies

Definition of Done

Exploratory findings are documented, triaged, and resolved according to release severity.

---

# TASK M9-061

Title

Validate Production Migration Path

Priority

P0

Effort

L

Dependencies

M9-057

Description

Test upgrades from all supported pre-release schemas.

Include

Local storage migration

Database migration

Cloud record migration

Export import from prior supported version

Rollback procedure

Definition of Done

Supported users can upgrade without losing valid data.

---

# TASK M9-062

Title

Validate Rollback Procedure

Priority

P0

Effort

M

Dependencies

M9-057

Description

Test release rollback.

Verify

Previous application deployment can be restored.

Database compatibility is understood.

Migration rollback or forward-fix path exists.

User data remains valid.

Monitoring detects rollback issues.

Definition of Done

The team can reverse a failed release safely.

---

# TASK M9-063

Title

Review Open Defects

Priority

P0

Effort

M

Dependencies

M9-058

M9-059

M9-060

Description

Review every open defect before release.

Requirements

No open P0 defect.

No unapproved P1 defect.

Every P2 and P3 defect has a documented decision.

Known limitations are included in release notes where relevant.

Definition of Done

Release risk is explicitly understood and approved.

---

# TASK M9-064

Title

Complete Version 1 Quality Sign-Off

Priority

P0

Effort

M

Dependencies

M9-061

M9-062

M9-063

Description

Complete final quality approval.

Sign-off areas

Formula correctness

Product requirements

UI compliance

Accessibility

Security

Performance

Persistence

Import and export

Deployment

Documentation

Definition of Done

Each required area has a named reviewer and an approved status.

---

# MILESTONE ACCEPTANCE CRITERIA

✓ Requirements traceability is complete.

✓ Every Version 1 Formula ID is implemented and tested.

✓ Golden Reference results are independently verified.

✓ Critical mathematical invariants pass.

✓ Services and Stores satisfy architectural rules.

✓ Critical desktop and mobile workflows pass.

✓ Supported browsers are verified.

✓ No critical accessibility issue remains.

✓ Keyboard and screen reader workflows are usable.

✓ No critical security issue remains.

✓ Row-Level Security is verified.

✓ Imports and exports pass security review.

✓ Performance targets are met or explicitly approved.

✓ Provider, persistence, and network failures are recoverable.

✓ Production monitoring is configured.

✓ User and developer documentation are current.

✓ Release candidate regression tests pass.

✓ Production migration and rollback are verified.

✓ No open P0 defect remains.

✓ Version 1 quality sign-off is complete.

---

# MILESTONE DEFINITION OF DONE

Milestone 9 is complete when ProfitPilot has passed application-wide verification and is approved as a Version 1 release candidate.

The release candidate must demonstrate

Correct financial calculations

Stable portfolio workflows

Reliable local-first persistence

Safe optional cloud synchronization

Accessible interaction

Secure data handling

Responsive performance

Recoverable failures

Complete documentation

Repeatable deployment

No feature should be considered production-ready solely because it works under ideal conditions.

ProfitPilot Version 1 must remain understandable and recoverable when calculations, providers, storage, networks, imports, synchronization, or user inputs fail.

---

END OF PAGE 9

NEXT

Page 10

Milestone 10 — Production Launch, Version 1 Completion & Post-Launch Operations

# 06_TASKS

Project

ProfitPilot

Page

10 of 10

Title

Milestone 10 — Production Launch, Version 1 Completion & Post-Launch Operations

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

05_AI_PROMPTS.md

Milestones 1–9

---

# MILESTONE OBJECTIVE

Prepare, launch, monitor, and maintain the first production release of ProfitPilot.

This milestone transitions the project from implementation to a supported production application.

The focus shifts from building features to

Reliable deployment

Operational stability

Issue response

User support

Continuous improvement

Documentation maintenance

Version management

Future planning

---

# RELEASE PHILOSOPHY

Version 1 should be

Stable

Predictable

Recoverable

Understandable

Well documented

The first production release is not the end of development.

It establishes a stable foundation that future versions can extend without compromising the integrity of the Formula Engine or user data.

---

# DELIVERABLES

✓ Production deployment completed

✓ Release process documented

✓ Monitoring enabled

✓ Incident procedures documented

✓ Version management established

✓ Documentation finalized

✓ Support workflows documented

✓ Operational checklist completed

✓ Version 1 released

✓ Post-launch review completed

✓ Version 2 backlog created

✓ Project completion documented

---

# IMPLEMENTATION ORDER

Release Preparation

↓

Production Deployment

↓

Monitoring

↓

Operations

↓

Documentation

↓

Post-Launch Review

↓

Version 2 Planning

↓

Project Completion

---

# RELEASE PREPARATION

---

# TASK M10-001

Title

Freeze Version 1 Scope

Priority

P0

Effort

S

Dependencies

M9-064

Description

Freeze Version 1 feature scope.

Requirements

No new features.

Only approved release fixes.

No undocumented Formula changes.

No UI redesign.

Definition of Done

The release branch contains only approved Version 1 work.

---

# TASK M10-002

Title

Create Version 1 Release Branch

Priority

P0

Effort

XS

Dependencies

M10-001

Description

Create the release branch following the project's Git workflow.

Definition of Done

Release work is isolated from future development.

---

# TASK M10-003

Title

Finalize Version Metadata

Priority

P0

Effort

S

Dependencies

M9-056

Description

Verify

Application version

Engine version

Formula version

Storage schema version

Database migration version

Documentation version

Definition of Done

All published version identifiers match.

---

# TASK M10-004

Title

Prepare Release Notes

Priority

P0

Effort

M

Dependencies

M10-003

Description

Document

Major features

Known limitations

Supported browsers

Supported devices

Storage options

Authentication options

Import/export capabilities

Breaking changes

Upgrade instructions

Definition of Done

Release notes accurately describe Version 1.

---

# PRODUCTION DEPLOYMENT

---

# TASK M10-005

Title

Configure Production Environment

Priority

P0

Effort

M

Dependencies

M10-002

Description

Verify production configuration.

Review

Environment variables

Supabase configuration

Deployment secrets

Security headers

Caching

Build configuration

Definition of Done

Production configuration matches Build Guide requirements.

---

# TASK M10-006

Title

Deploy Version 1

Priority

P0

Effort

M

Dependencies

M10-005

Description

Deploy the approved release candidate.

Requirements

Immutable build.

Tagged release.

Production database migrations.

Production assets.

Definition of Done

Version 1 is available in production.

---

# TASK M10-007

Title

Verify Production Deployment

Priority

P0

Effort

M

Dependencies

M10-006

Description

Review production deployment.

Verify

Application startup

Dashboard

Portfolio management

Simulation

Loop Builder

Exit Planner

Import/export

Authentication

Synchronization

Definition of Done

Production behaves identically to the approved release candidate.

---

# TASK M10-008

Title

Create Rollback Package

Priority

P0

Effort

S

Dependencies

M10-006

Description

Prepare rollback artifacts.

Include

Previous deployment

Migration strategy

Recovery documentation

Definition of Done

Rollback can be initiated immediately if required.

---

# PRODUCTION MONITORING

---

# TASK M10-009

Title

Enable Production Monitoring

Priority

P0

Effort

M

Dependencies

M9-049

Description

Enable monitoring configured during Milestone 9.

Monitor

Application errors

Provider failures

Synchronization failures

Import failures

Unexpected crashes

Definition of Done

Critical production issues become visible quickly.

---

# TASK M10-010

Title

Verify Production Logging

Priority

P1

Effort

S

Dependencies

M10-009

Description

Confirm structured logging works correctly.

Verify

Error identifiers

Version identifiers

Formula version

Engine version

Sanitized context

Definition of Done

Logs support troubleshooting without exposing user financial data.

---

# TASK M10-011

Title

Review Production Health

Priority

P1

Effort

S

Dependencies

M10-009

Description

Review

Error rate

Performance

Availability

Successful synchronization

Provider stability

Definition of Done

No unexpected production issues remain after launch.

---

# OPERATIONS

---

# TASK M10-012

Title

Create Operational Runbook

Priority

P0

Effort

L

Dependencies

M10-011

Description

Document operational procedures.

Include

Deployment

Rollback

Provider outage

Supabase outage

Authentication failure

Synchronization issues

Import failures

Data recovery

Definition of Done

Routine operational work follows documented procedures.

---

# TASK M10-013

Title

Document Incident Response Workflow

Priority

P0

Effort

M

Dependencies

M10-012

Description

Document

Incident detection

Classification

Escalation

Communication

Resolution

Postmortem

Definition of Done

Every production incident follows one documented process.

---

# TASK M10-014

Title

Create Support Playbook

Priority

P1

Effort

M

Dependencies

M10-013

Description

Document support procedures.

Include

Import problems

Export recovery

Synchronization issues

Portfolio recovery

Authentication

Formula explanations

Known limitations

Definition of Done

Common support requests have documented responses.

---

# TASK M10-015

Title

Document Known Issues

Priority

P1

Effort

S

Dependencies

M10-014

Description

Maintain a Version 1 known issues list.

Include

Limitations

Workarounds

Future improvements

Definition of Done

Known limitations remain transparent.

---

# DOCUMENTATION COMPLETION

---

# TASK M10-016

Title

Review Documentation Set

Priority

P0

Effort

L

Dependencies

All Documentation

Description

Review

README

PRD

Formula Specification

UI Specification

Build Guide

AI Prompts

Implementation Tasks

Verify

Consistency

Terminology

Cross references

Version identifiers

Definition of Done

Documentation is internally consistent.

---

# TASK M10-017

Title

Publish Developer Documentation

Priority

P1

Effort

M

Dependencies

M10-016

Description

Prepare developer documentation for publication.

Include

Setup

Architecture

Testing

Deployment

Contribution guide

Definition of Done

New developers can onboard using documentation only.

---

# TASK M10-018

Title

Publish User Documentation

Priority

P1

Effort

M

Dependencies

M10-016

Description

Prepare user documentation.

Include

Portfolio creation

Dashboard

Simulation

Loop Builder

Exit Planner

Import/export

Cloud synchronization

Definition of Done

Users can understand Version 1 without external assistance.

---

# VERSION MANAGEMENT

---

# TASK M10-019

Title

Create Versioning Strategy

Priority

P1

Effort

S

Dependencies

M10-003

Description

Document

Semantic versioning

Formula versioning

Storage versioning

Migration policy

Deprecation policy

Definition of Done

Future releases follow documented versioning rules.

---

# TASK M10-020

Title

Create Maintenance Schedule

Priority

P2

Effort

S

Dependencies

M10-019

Description

Define

Bug-fix releases

Security updates

Dependency updates

Documentation reviews

Definition of Done

Maintenance expectations are documented.

---

# POST-LAUNCH REVIEW

---

# TASK M10-021

Title

Conduct Version 1 Retrospective

Priority

P1

Effort

M

Dependencies

M10-006

Description

Review

Architecture

Documentation

Development workflow

Testing

Deployment

Lessons learned

Definition of Done

Improvement opportunities are documented.

---

# TASK M10-022

Title

Review Technical Debt

Priority

P1

Effort

M

Dependencies

M10-021

Description

Identify

Deferred features

Refactoring opportunities

Performance improvements

Developer experience improvements

Definition of Done

Technical debt is prioritized.

---

# TASK M10-023

Title

Create Version 2 Backlog

Priority

P1

Effort

L

Dependencies

M10-022

Description

Prepare the initial roadmap.

Potential items

Additional protocols

Wallet integrations

Live portfolio imports

Advanced simulations

Portfolio analytics

Tax reporting

AI insights

Mobile application

Definition of Done

Version 2 work is prioritized without affecting Version 1 stability.

---

# TASK M10-024

Title

Archive Version 1 Planning

Priority

P2

Effort

S

Dependencies

M10-023

Description

Archive completed planning artifacts.

Keep

Historical roadmap

Milestone completion

Release notes

Definition of Done

Historical planning remains available for future reference.

---

# PROJECT COMPLETION

---

# TASK M10-025

Title

Finalize Version 1

Priority

P0

Effort

S

Dependencies

M10-024

Description

Confirm

Release completed

Documentation complete

Monitoring active

Support documentation available

Known issues documented

Definition of Done

Version 1 is officially complete.

---

# TASK M10-026

Title

Celebrate the Release

Priority

P3

Effort

XS

Dependencies

M10-025

Description

Recognize the completion of Version 1.

Document

Project timeline

Milestones achieved

Lessons learned

Future vision

Definition of Done

The team closes Version 1 intentionally before beginning Version 2.

---

# VERSION 1 FINAL ACCEPTANCE CHECKLIST

## Engineering

✓ Formula Engine complete

✓ Service architecture complete

✓ UI implemented

✓ Persistence completed

✓ Authentication optional

✓ Cloud synchronization completed

✓ Import/export completed

✓ Tests passing

---

## Quality

✓ Accessibility completed

✓ Security reviewed

✓ Performance validated

✓ Error handling verified

✓ Recovery verified

✓ Documentation complete

---

## Product

✓ Dashboard completed

✓ Portfolio Management completed

✓ Simulation Workspace completed

✓ Loop Builder completed

✓ Exit Planner completed

✓ Recommendation Center completed

✓ Local-first workflow completed

---

## Operations

✓ Production deployment completed

✓ Monitoring enabled

✓ Incident response documented

✓ Release notes published

✓ Rollback available

✓ Version metadata finalized

---

## Documentation

✓ README

✓ PRD

✓ Formula Specification

✓ UI Specification

✓ Build Guide

✓ AI Prompt Library

✓ Implementation Roadmap

All documents are internally consistent and version aligned.

---

# PROJECT DEFINITION OF DONE

ProfitPilot Version 1 is complete when:

✓ Every documented Formula ID has a canonical implementation.

✓ Every calculation is deterministic.

✓ All financial calculations are independently testable.

✓ The Formula Engine remains framework-independent.

✓ All application features consume Services instead of implementing formulas.

✓ Local-first persistence is fully operational.

✓ Cloud synchronization is optional and reliable.

✓ Users retain ownership of their data.

✓ Critical workflows are accessible.

✓ Security and privacy requirements are satisfied.

✓ Performance targets are achieved.

✓ Documentation is complete.

✓ Production deployment is stable.

✓ Monitoring is operational.

✓ Recovery procedures are documented.

✓ Version 1 has successfully passed quality sign-off.

---

# PROJECT SUCCESS CRITERIA

Version 1 succeeds if a user can:

• Create one or more leveraged Bitcoin portfolios.

• Understand their current financial position.

• Monitor Health Factor and liquidation risk.

• Explore future scenarios safely.

• Evaluate leverage strategies.

• Plan complete or partial exits.

• Receive transparent, deterministic recommendations.

• Save, export, import, and synchronize their work.

• Trust that every calculation is documented, reproducible, and verifiable.

---

# FINAL ENGINEERING PRINCIPLES

ProfitPilot should always be

Deterministic

Transparent

Explainable

Recoverable

Accessible

Maintainable

Well documented

Framework-independent

User-owned

Financially conservative

Every engineering decision should reinforce these principles.

---

# IMPLEMENTATION ROADMAP SUMMARY

This roadmap contains

✓ 10 implementation milestones

✓ 250+ implementation tasks

✓ Complete dependency ordering

✓ Priority classifications

✓ Effort estimates

✓ Acceptance criteria

✓ Definitions of Done

✓ Release preparation

✓ Operational readiness

Together with the remaining project documentation, it provides a complete blueprint for implementing ProfitPilot Version 1 from an empty repository through production deployment.

---

# END OF DOCUMENT

`06_TASKS.md` — COMPLETE

---

## ProfitPilot Documentation Suite

✓ README.md

✓ 01_PRD.md

✓ 02_FORMULAS.md

✓ 03_UI.md

✓ 04_BUILD_GUIDE.md

✓ 05_AI_PROMPTS.md

✓ 06_TASKS.md

**Documentation Status:** COMPLETE

**Implementation Status:** Ready for Development

**Next Phase:** Begin Milestone 1 — Project Foundation
