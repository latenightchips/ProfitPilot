# 04_BUILD_GUIDE

Project

ProfitPilot

Page

1 of 10

Title

Architecture, Engineering Principles & Technology Stack

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

---

# PURPOSE

This document defines how ProfitPilot must be engineered.

Its purpose is to ensure that every implementation produced by AI or human developers follows the same architecture, coding standards, and engineering principles.

The Build Guide is the authoritative reference for software implementation.

When conflicts exist between implementation and documentation, this document takes precedence for engineering decisions, while the PRD remains the source of product requirements.

---

# ENGINEERING PHILOSOPHY

ProfitPilot is designed as an engineering-first application.

Primary goals

Correctness

↓

Maintainability

↓

Readability

↓

Performance

↓

Scalability

Financial correctness is always more important than development speed.

Readable code is preferred over clever code.

Every calculation should be deterministic.

Every UI component should be reusable.

Every module should have a single responsibility.

---

# DEVELOPMENT PRINCIPLES

Follow these principles throughout the project.

Single Responsibility Principle

One component.

One purpose.

One responsibility.

Composition over inheritance.

Pure functions whenever possible.

Immutable data where practical.

No duplicated business logic.

No hidden calculations.

No magic numbers.

No undocumented behavior.

---

# TECHNOLOGY STACK

Frontend

Next.js 15

React 19

TypeScript

Backend

Next.js Server Actions

Future

Node Services

Database

Supabase PostgreSQL

Authentication

Supabase Auth

Future

Wallet Authentication

State Management

Zustand

Forms

React Hook Form

Validation

Zod

Styling

Tailwind CSS

Component Library

shadcn/ui

Charts

Recharts

Tables

TanStack Table

Icons

Lucide React

Date Utilities

date-fns

Testing

Vitest

React Testing Library

Playwright

Deployment

Vercel

Monitoring

Sentry

Analytics

PostHog (Future)

---

# PROJECT STRUCTURE

ProfitPilot/

app/

components/

features/

lib/

hooks/

services/

stores/

types/

utils/

styles/

public/

docs/

tests/

Every folder has a clearly defined purpose.

No business logic belongs inside UI components.

---

# ARCHITECTURE OVERVIEW

Application

↓

Pages

↓

Features

↓

Components

↓

Hooks

↓

Services

↓

Formula Engine

↓

Data Layer

↓

External APIs

Business logic always flows downward.

UI components never calculate financial values directly.

---

# LAYER RESPONSIBILITIES

Presentation Layer

User Interface only.

Application Layer

Coordinates features.

Business Layer

Portfolio logic.

Formula Layer

Financial calculations.

Infrastructure Layer

API communication.

Persistence Layer

Database access.

Every layer communicates only with adjacent layers.

---

# FORMULA ENGINE

The Formula Engine is the heart of ProfitPilot.

Responsibilities

Portfolio calculations

Loop calculations

Health Factor

Liquidation

Interest

Simulation

Recommendations

No UI component may implement financial calculations independently.

All calculations originate from the Formula Engine.

---

# CODING STANDARDS

Language

TypeScript Strict Mode

Indentation

2 Spaces

Quotes

Single Quotes

Semicolons

Required

Imports

Absolute Imports

Linting

ESLint

Formatting

Prettier

Consistency is mandatory.

---

# FILE NAMING

React Components

PascalCase

PortfolioCard.tsx

Hooks

camelCase

usePortfolio.ts

Utilities

camelCase

calculateHF.ts

Types

camelCase

portfolio.ts

Constants

UPPER_CASE

DEFAULT_HF

Environment Files

UPPER_CASE

.env.local

---

# SOURCE OF TRUTH

One formula.

One implementation.

One data model.

One component.

One state store.

Duplicate implementations are prohibited.

---

# DOCUMENTATION RULES

Every exported function should include

Purpose

Inputs

Outputs

Related Formula IDs

Example Usage

Complex calculations require inline explanations.

---

# ENGINEERING CHECKLIST

Before writing code

Read

README

PRD

FORMULAS

UI

Never implement functionality without consulting documentation first.

---

# ACCEPTANCE CRITERIA

✓ Technology stack defined.

✓ Architecture documented.

✓ Layer responsibilities established.

✓ Formula Engine designated as the single calculation source.

✓ Coding standards documented.

✓ Folder structure defined.

✓ Engineering principles established.

---

END OF PAGE 1

NEXT

Page 2

Repository Structure & Folder Organization

# 04_BUILD_GUIDE

Project

ProfitPilot

Page

2 of 10

Title

Repository Structure & Folder Organization

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

---

# PURPOSE

This chapter defines the physical organization of the ProfitPilot repository.

A consistent folder structure improves readability, simplifies maintenance, and enables AI coding agents to locate files without ambiguity.

Every file belongs to one clearly defined location.

---

# ARCHITECTURE PRINCIPLE

Organize by feature first.

Organize by file type second.

Avoid large generic folders containing unrelated code.

The repository should scale from Version 1.0 to future multi-asset support without restructuring.

---

# REPOSITORY STRUCTURE

ProfitPilot/

│

├── app/

├── features/

├── components/

├── services/

├── lib/

├── stores/

├── hooks/

├── types/

├── utils/

├── constants/

├── providers/

├── styles/

├── public/

├── docs/

├── tests/

├── scripts/

├── supabase/

├── .github/

└── package.json

---

# APP DIRECTORY

Purpose

Application routing using the Next.js App Router.

Example

app/

layout.tsx

page.tsx

dashboard/

portfolio/

simulation/

loop-builder/

exit-planner/

settings/

api/

Each route should contain only page composition.

Business logic belongs elsewhere.

---

# FEATURES DIRECTORY

Purpose

Contains business domains.

Example

features/

dashboard/

portfolio/

simulation/

loopBuilder/

exitPlanner/

settings/

Each feature contains

components/

hooks/

services/

types/

utils/

tests/

Feature modules should be self-contained whenever possible.

---

# COMPONENTS DIRECTORY

Purpose

Reusable UI components shared across multiple features.

Examples

KPICard/

MetricRow/

RecommendationCard/

HealthFactorGauge/

DecisionCard/

StrategySnapshot/

MarketSnapshot/

EmergencyAlert/

Tooltip/

Modal/

Button/

Input/

Table/

Chart/

Components in this directory must remain business-agnostic.

---

# SERVICES DIRECTORY

Purpose

Application business services.

Examples

PortfolioService

SimulationService

LoopService

ExitPlannerService

RecommendationService

ExportService

PriceService

NotificationService

Only services communicate directly with the Formula Engine.

---

# LIB DIRECTORY

Purpose

Shared application infrastructure.

Examples

Formula Engine

API Clients

Database Client

Logger

Configuration

Math Utilities

Formatting

Caching

This directory contains no UI code.

---

# STORES DIRECTORY

Purpose

Global application state.

Technology

Zustand

Stores

PortfolioStore

SimulationStore

SettingsStore

NotificationStore

DeveloperStore

Stores contain state only.

Complex calculations remain inside Services.

---

# HOOKS DIRECTORY

Purpose

Reusable React hooks.

Examples

usePortfolio()

useSimulation()

useSettings()

useMarketData()

useDeveloperMode()

Hooks coordinate UI with Services.

Hooks never contain financial calculations.

---

# TYPES DIRECTORY

Purpose

Shared TypeScript interfaces.

Examples

Portfolio

Debt

Collateral

Simulation

Recommendation

FormulaResult

APIResponse

Every public object must have an explicit type.

---

# UTILS DIRECTORY

Purpose

General helper functions.

Examples

formatCurrency()

formatBTC()

formatPercentage()

formatDate()

parseNumber()

Utilities should remain pure and deterministic.

---

# CONSTANTS DIRECTORY

Purpose

Centralized constants.

Examples

Default Health Factor

Supported Currencies

Theme Options

Refresh Intervals

Route Names

Protocol Limits

Avoid hardcoded values throughout the application.

---

# PROVIDERS DIRECTORY

Purpose

React Context providers.

Examples

ThemeProvider

SupabaseProvider

DeveloperProvider

NotificationProvider

Providers should remain lightweight.

Avoid business logic inside providers.

---

# TESTS DIRECTORY

Purpose

Shared testing infrastructure.

Structure

unit/

integration/

e2e/

fixtures/

golden/

The "golden" folder contains the official reference scenarios defined in 02_FORMULAS.md.

---

# DOCS DIRECTORY

Purpose

Project documentation.

Contents

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

05_AI_PROMPTS.md

06_TASKS.md

Documentation is version controlled alongside the application.

---

# GITHUB DIRECTORY

Purpose

Repository automation.

Contents

GitHub Actions

CI/CD

Issue Templates

Pull Request Templates

Release Workflow

Automated testing should execute before every merge.

---

# FILE SIZE GUIDELINES

Target Maximum Sizes

Component

300 Lines

Hook

200 Lines

Service

500 Lines

Formula File

300 Lines

Utility

150 Lines

If a file exceeds these limits, consider refactoring.

---

# IMPORT RULES

Allowed

Feature

↓

Shared Components

↓

Services

↓

Formula Engine

↓

Utilities

Not Allowed

Feature A

↓

Feature B Internal Files

Always import through public exports.

Avoid deep relative imports.

---

# PUBLIC EXPORTS

Each feature should expose a single entry point.

Example

features/portfolio/index.ts

Exports

Components

Hooks

Types

Services

Internal implementation details remain private.

---

# ACCEPTANCE CRITERIA

✓ Repository structure documented.

✓ Feature-first architecture established.

✓ Folder responsibilities defined.

✓ Import rules documented.

✓ Shared components separated from business logic.

✓ File size guidelines established.

✓ Public export strategy documented.

---

END OF PAGE 2

NEXT

Page 3

Data Flow, Services & Formula Engine Integration

# 04_BUILD_GUIDE

Project

ProfitPilot

Page

3 of 10

Title

Application Data Flow, Service Layer & Formula Engine

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

---

# PURPOSE

This chapter defines how data flows through ProfitPilot.

Every calculation, user interaction and API request must follow the same architecture.

No shortcuts are permitted.

The objective is to ensure predictable, testable and maintainable software.

---

# ARCHITECTURE OVERVIEW

Presentation Layer

↓

Features

↓

Services

↓

Engine

↓

Infrastructure

↓

Database / External APIs

Each layer has one responsibility.

---

# RESPONSIBILITY OF EACH LAYER

Presentation

Displays information.

Collects user input.

No business logic.

No calculations.

---

Features

Coordinate a complete business workflow.

Examples

Dashboard

Portfolio

Simulation

Loop Builder

Exit Planner

Settings

Features combine multiple components.

---

Services

Application orchestration.

Responsibilities

Load portfolio

Call Engine

Combine API data

Generate recommendations

Store results

Return formatted objects

Services contain business workflows.

---

Engine

The mathematical core of ProfitPilot.

Responsible for

Portfolio Mathematics

Loop Mathematics

Health Factor

Liquidation

Interest

Risk

Recommendations

Scenario Simulation

Validation

The Engine never imports React.

The Engine never imports Next.js.

The Engine never accesses databases.

The Engine receives data.

The Engine returns calculations.

Nothing more.

---

Infrastructure

Handles communication with external systems.

Responsibilities

Supabase

CoinGecko

Aave

Logging

Caching

Authentication

Monitoring

Infrastructure performs no financial calculations.

---

# COMPLETE DATA FLOW

User changes BTC Price

↓

Simulation Component

↓

Simulation Feature

↓

Simulation Service

↓

Engine

↓

Formula Modules

↓

Simulation Service

↓

React State

↓

UI Refresh

Every calculation follows this exact flow.

---

# ENGINE STRUCTURE

engine/

portfolio/

loop/

interest/

health/

liquidation/

simulation/

recommendation/

validation/

shared/

index.ts

Each module owns one financial domain.

---

# ENGINE MODULES

Portfolio Engine

Calculates

Portfolio Value

Net Worth

Exposure

Allocation

---

Loop Engine

Calculates

Borrow Cycles

Loop Count

Maximum Exposure

Remaining Borrow Capacity

---

Interest Engine

Calculates

Daily Interest

Monthly Interest

Annual Interest

Break-even Cost

Projected Interest

---

Health Engine

Calculates

Health Factor

LTV

Safety Margin

Risk Classification

---

Liquidation Engine

Calculates

Liquidation Price

Distance

Remaining Buffer

Projected Liquidation

---

Simulation Engine

Calculates

Future Portfolio

Future Debt

Future HF

Future Interest

Future Net Worth

---

Recommendation Engine

Produces

Hold

Reduce Debt

Increase Collateral

Avoid Loop

Safe to Borrow

Emergency Exit

Recommendations always include reasoning.

---

Validation Engine

Responsible for

Input Validation

Formula Validation

Reference Portfolio

Golden Tests

Protocol Limits

No invalid portfolio enters the Engine.

---

# SERVICE RESPONSIBILITIES

Portfolio Service

Loads portfolio.

Calls Portfolio Engine.

Returns Portfolio Model.

---

Simulation Service

Builds simulation request.

Calls Simulation Engine.

Returns comparison results.

---

Loop Service

Calls Loop Engine.

Produces optimal leverage.

Returns strategy proposal.

---

Exit Planner Service

Calls

Portfolio Engine

Health Engine

Recommendation Engine

Produces exit strategy.

---

Recommendation Service

Combines

Portfolio

Risk

Interest

Simulation

Returns

Today's Decision

Priority Alerts

Portfolio Score

---

# DATA OBJECTS

Every Service exchanges typed objects.

Examples

Portfolio

SimulationInput

SimulationResult

LoopStrategy

Recommendation

MarketData

HealthReport

No raw JSON should travel beyond Infrastructure.

---

# ERROR HANDLING

Errors flow upward.

Infrastructure

↓

Service

↓

Feature

↓

UI

Each layer adds context.

Never expose internal errors directly to users.

---

# CACHING STRATEGY

Cache

BTC Price

APR

Protocol Parameters

Never Cache

Portfolio Calculations

Simulation Results

Health Factor

Live calculations always use the latest portfolio state.

---

# DEPENDENCY RULES

Allowed

Presentation

↓

Features

↓

Services

↓

Engine

↓

Infrastructure

Forbidden

Engine

↓

React

Engine

↓

Database

Engine

↓

API

Services

↓

UI

Infrastructure

↓

Engine

Dependency direction is always one-way.

---

# TESTABILITY

Every Engine module

Accepts typed input.

Returns typed output.

Produces deterministic results.

Requires no browser.

Requires no database.

Requires no network.

Every module can be unit tested independently.

---

# PERFORMANCE TARGETS

Portfolio Calculation

<10ms

Loop Calculation

<20ms

Simulation

<50ms

Recommendation

<20ms

Dashboard Refresh

<100ms

The Engine should comfortably support real-time recalculation.

---

# ACCEPTANCE CRITERIA

✓ Data flow documented.

✓ Engine architecture defined.

✓ Service responsibilities established.

✓ Dependency rules documented.

✓ Typed object strategy defined.

✓ Error handling standardized.

✓ Performance targets established.

---

END OF PAGE 3

NEXT

Page 4

Database Design, Data Models & State Management

# 04_BUILD_GUIDE

Project

ProfitPilot

Page

5 of 10

Title

API Integration, External Services & Security

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

---

# PURPOSE

This chapter defines how ProfitPilot communicates with external services.

External services provide market prices, lending protocol parameters, authentication, storage, monitoring and future wallet data.

External services never perform ProfitPilot calculations.

All external data must be validated before entering the application.

---

# INTEGRATION PRINCIPLE

External Provider

↓

Infrastructure Adapter

↓

Validation

↓

Service Layer

↓

Engine

↓

Application State

↓

User Interface

The Engine never communicates directly with an external API.

---

# VERSION 1 INTEGRATIONS

Required

Manual Data Entry

BTC Price Provider

Aave Protocol Parameters

Local Portfolio Storage

Optional

Supabase

Sentry

Future

Wallet Connection

On-chain Portfolio Reading

Notifications

Multiple Lending Protocols

---

# MANUAL MODE

Manual Mode must always remain available.

Purpose

Allow ProfitPilot to function without external APIs.

Manual Inputs

BTC Price

BTC Holdings

Collateral Amount

Debt Amount

Borrow APR

Maximum LTV

Liquidation Threshold

Supply APR

Manual values should clearly display

Manual Data

as their source.

---

# PRICE SERVICE

Purpose

Retrieve BTC market prices.

Preferred Provider

CoinGecko

Fallback

Manual Entry

Future Providers

Coinbase

Kraken

Binance

Chainlink

Price Service Output

Asset Symbol

Price

Currency

Provider

Timestamp

Freshness Status

---

# PRICE SERVICE INTERFACE

```ts
export interface PriceQuote {
  asset: string;
  currency: string;
  price: number;
  provider: string;
  timestamp: string;
  isStale: boolean;
}

export interface PriceProvider {
  getPrice(asset: string, currency: string): Promise<PriceQuote>;
}
```

The application must depend on the interface rather than a specific provider.

---

# PRICE FRESHNESS

Fresh

Updated within 5 minutes.

Stale

Older than 5 minutes.

Unavailable

No valid price exists.

When price data is stale

Display a warning.

Continue calculations only after clearly labeling the data as stale.

When price data is unavailable

Use manual input or the last confirmed value.

Do not silently invent a price.

---

# PROTOCOL SERVICE

Purpose

Provide lending protocol parameters.

Version 1 Protocol

Aave V3

Required Parameters

Protocol Name

Network

Collateral Asset

Borrow Asset

Maximum LTV

Liquidation Threshold

Liquidation Bonus

Borrow APR

Supply APR

Last Updated

Source

---

# PROTOCOL PARAMETER MODEL

```ts
export interface ProtocolParameters {
  protocol: string;
  network: string;
  collateralAsset: string;
  borrowAsset: string;
  maximumLtv: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  borrowApr: number;
  supplyApr: number;
  source: string;
  updatedAt: string;
}
```

Protocol parameters must never be hardcoded inside formulas.

Default values may exist only as clearly labeled example values.

---

# PROTOCOL ADAPTER

Every lending protocol must implement a common interface.

```ts
export interface ProtocolProvider {
  getParameters(
    collateralAsset: string,
    borrowAsset: string
  ): Promise<ProtocolParameters>;
}
```

Future support for Morpho, Spark or Compound should require a new adapter rather than changes to the Engine.

---

# SERVICE FALLBACK ORDER

For market prices

1.

Live provider

2.

Last valid cached value

3.

Manual input

For protocol parameters

1.

Live protocol source

2.

Last verified configuration

3.

Manual configuration

Every fallback must be visible to the user.

---

# API CLIENT RULES

Every API client must include

Timeout

Retry Limit

Schema Validation

Error Mapping

Request Logging without sensitive data

Cancellation Support

No client should retry indefinitely.

Recommended defaults

Timeout

8 seconds

Retry Count

2

Cache Duration

Price

60 seconds

Protocol Parameters

24 hours

---

# RESPONSE VALIDATION

All API responses must be validated with Zod.

Example

```ts
import { z } from 'zod';

export const priceQuoteSchema = z.object({
  asset: z.string().min(1),
  currency: z.string().min(1),
  price: z.number().positive(),
  provider: z.string().min(1),
  timestamp: z.string().datetime(),
  isStale: z.boolean()
});
```

Unvalidated API data must never reach Services or the Engine.

---

# API ERROR MODEL

```ts
export interface ServiceError {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  provider?: string;
  timestamp: string;
}
```

Errors displayed to users must be simple and actionable.

Example

Incorrect

Request failed with status 429.

Correct

The BTC price provider is temporarily rate-limited. ProfitPilot is using the last confirmed price.

---

# SECURITY PRINCIPLES

Never request or store

Private Keys

Seed Phrases

Wallet Recovery Phrases

Transaction Signing Permissions

Version 1 is read-only and calculation-only.

---

# SECRET MANAGEMENT

API credentials belong in environment variables.

Example

```text
NEXT_PUBLIC_PRICE_API_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SENTRY_DSN=
```

Never commit real credentials.

Provide

.env.example

with placeholder values.

---

# CLIENT AND SERVER BOUNDARIES

Public market data may be retrieved from the client when safe.

Credentials or protected operations must execute on the server.

Server-only files must never be imported into client components.

Use

server-only

where appropriate.

---

# AUTHENTICATION

Version 1

Optional.

The app should work without an account using local storage.

Optional accounts may provide

Cloud sync

Multiple portfolios

Saved simulations

Cross-device access

Authentication must not block core calculations.

---

# MULTI-PORTFOLIO SUPPORT

The data model supports multiple portfolios.

Each portfolio contains

Unique ID

Name

Positions

Settings

Saved Simulations

Saved Exit Plans

One portfolio is marked

Default

The initial UI may automatically open the default portfolio.

Example Portfolios

BTC Long-Term

Conservative Strategy

Testing Portfolio

Paper Portfolio

---

# PORTFOLIO ACCESS RULES

Without authentication

Portfolios remain on the local device.

With authentication

Users may access only portfolios associated with their account.

Database access must use row-level security.

No user may read another user's portfolio.

---

# SUPABASE SECURITY

If Supabase is enabled

Use Row Level Security.

Every user-owned table must include

user_id

Required policy

Authenticated users may access only rows where

auth.uid() = user_id

Never rely only on frontend filtering.

---

# LOGGING

Allowed

Provider name

Request duration

HTTP status

Error code

Timestamp

Forbidden

Portfolio amount

Debt amount

BTC holdings

Authentication tokens

API secrets

Sensitive financial data should not appear in logs.

---

# RATE LIMITING

Protect server endpoints from abuse.

Recommended initial limits

Price endpoint

60 requests per minute per client

Protocol endpoint

20 requests per minute per client

Export endpoint

10 requests per minute per client

Exact limits remain configurable.

---

# WALLET INTEGRATION

Future Version

Wallet integration should initially be read-only.

Allowed

Read address

Read supplied collateral

Read borrowed balance

Read Health Factor

Not Allowed by Default

Sign transactions

Borrow

Repay

Swap

Withdraw

Transaction execution requires a separate security review.

---

# FAILURE BEHAVIOR

If CoinGecko fails

Use cached or manual price.

If Aave data fails

Use last verified parameters and show a warning.

If Supabase fails

Continue in local mode.

If monitoring fails

Application functionality continues.

No optional integration should prevent core calculations.

---

# TESTING REQUIREMENTS

Each provider requires tests for

Valid response

Invalid response

Timeout

Rate limit

Malformed data

Stale data

Unavailable provider

Fallback behavior

No network dependency should exist in unit tests.

Use mocked providers.

---

# DIRECTORY STRUCTURE

```text
infrastructure/
├── pricing/
│   ├── PriceProvider.ts
│   ├── CoinGeckoProvider.ts
│   ├── ManualPriceProvider.ts
│   └── schemas.ts
├── protocols/
│   ├── ProtocolProvider.ts
│   ├── AaveV3Provider.ts
│   ├── ManualProtocolProvider.ts
│   └── schemas.ts
├── storage/
│   ├── LocalStorageAdapter.ts
│   └── SupabaseAdapter.ts
├── monitoring/
│   └── SentryAdapter.ts
└── auth/
    └── SupabaseAuthAdapter.ts
```

---

# AI IMPLEMENTATION RULES

AI coding agents must

Create provider interfaces before provider implementations.

Validate every external response.

Keep fallback behavior visible.

Preserve Manual Mode.

Keep financial calculations out of infrastructure code.

Never introduce wallet transaction execution in Version 1.

Never store secrets in source control.

---

# ACCEPTANCE CRITERIA

✓ Manual Mode works without external services.

✓ Price provider interface is defined.

✓ Aave protocol provider is defined.

✓ Every API response is validated.

✓ Fallback behavior is implemented.

✓ Stale data is clearly labeled.

✓ Multi-portfolio storage is supported.

✓ Authentication remains optional.

✓ Row-level security is required for cloud data.

✓ No external integration performs financial calculations.

✓ No private keys or wallet secrets are requested.

---

END OF PAGE 5

NEXT

Page 6

Formula Engine Implementation & Testing Order

# 04_BUILD_GUIDE

Project

ProfitPilot

Page

6 of 10

Title

Formula Engine Implementation, Precision & Testing Order

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

Pages 1–5 of 04_BUILD_GUIDE.md

---

# PURPOSE

This chapter defines how the ProfitPilot Formula Engine must be implemented and tested.

The Engine is the financial core of the application.

Its outputs influence leverage, liquidation risk, debt projections, simulations, and recommendations.

For this reason, Engine correctness has higher priority than UI speed, visual polish, or feature count.

No feature that depends on financial calculations may be considered complete until its corresponding Engine formulas have passed unit, golden-reference, boundary, and regression tests.

---

# CORE ENGINE RULE

One documented formula.

One canonical implementation.

One verified test suite.

All financial calculations must originate from the Engine.

UI components, hooks, stores, API adapters, and database modules must never reproduce Formula Engine logic.

---

# ENGINE CHARACTERISTICS

The Engine must be

Framework-independent

Deterministic

Pure whenever practical

Strongly typed

Side-effect free

Testable without network access

Testable without a browser

Independent of React

Independent of Next.js

Independent of Supabase

Independent of external APIs

Reusable by future applications

---

# ENGINE INPUT AND OUTPUT FLOW

Validated Input

↓

Domain Calculation

↓

Structured Result

↓

Warnings and Metadata

↓

Service Layer

The Engine receives already validated domain data.

It returns typed calculation results.

The Engine does not format values for display.

It does not fetch prices.

It does not save results.

It does not mutate application state.

---

# ENGINE DIRECTORY

```text
engine/
├── portfolio/
│   ├── calculatePortfolioValue.ts
│   ├── calculateNetWorth.ts
│   ├── calculateDebtRatio.ts
│   ├── calculateEquityRatio.ts
│   ├── calculateEffectiveLeverage.ts
│   ├── types.ts
│   ├── index.ts
│   └── tests/
│
├── loop/
│   ├── calculateBorrowCapacity.ts
│   ├── calculateLoopStep.ts
│   ├── calculateRecursiveExposure.ts
│   ├── calculateOptimalLoopStrategy.ts
│   ├── types.ts
│   ├── index.ts
│   └── tests/
│
├── health/
│   ├── calculateHealthFactor.ts
│   ├── calculateTargetDebt.ts
│   ├── calculateAdditionalBorrow.ts
│   ├── classifyHealthFactor.ts
│   ├── types.ts
│   ├── index.ts
│   └── tests/
│
├── liquidation/
│   ├── calculateLiquidationPrice.ts
│   ├── calculateLiquidationDistance.ts
│   ├── calculateLiquidationBuffer.ts
│   ├── types.ts
│   ├── index.ts
│   └── tests/
│
├── interest/
│   ├── calculateDailyInterest.ts
│   ├── calculateAccruedDebt.ts
│   ├── calculateBreakEvenAppreciation.ts
│   ├── calculateTimeToTargetHealthFactor.ts
│   ├── types.ts
│   ├── index.ts
│   └── tests/
│
├── simulation/
│   ├── simulatePriceChange.ts
│   ├── simulateAprChange.ts
│   ├── simulateRepayment.ts
│   ├── simulateCollateralAddition.ts
│   ├── compareScenarios.ts
│   ├── types.ts
│   ├── index.ts
│   └── tests/
│
├── exit/
│   ├── calculateRepaymentRequired.ts
│   ├── calculateBtcSaleRequired.ts
│   ├── calculateExitProfit.ts
│   ├── buildExitPlan.ts
│   ├── types.ts
│   ├── index.ts
│   └── tests/
│
├── recommendation/
│   ├── evaluateRiskRules.ts
│   ├── buildRecommendations.ts
│   ├── calculatePortfolioScore.ts
│   ├── types.ts
│   ├── index.ts
│   └── tests/
│
├── validation/
│   ├── validatePortfolioInput.ts
│   ├── validateProtocolParameters.ts
│   ├── validateSimulationInput.ts
│   ├── types.ts
│   ├── index.ts
│   └── tests/
│
├── shared/
│   ├── decimal.ts
│   ├── assertions.ts
│   ├── result.ts
│   ├── warnings.ts
│   ├── formulaMetadata.ts
│   └── types.ts
│
└── index.ts
```

---

# FORMULA IMPLEMENTATION TEMPLATE

Every formula implementation should follow one consistent pattern.

```ts
import type { FormulaResult } from '@/engine/shared/types';

export interface CalculateHealthFactorInput {
  collateralValue: number;
  liquidationThreshold: number;
  debtValue: number;
}

export type CalculateHealthFactorResult = FormulaResult<number>;

export function calculateHealthFactor(
  input: CalculateHealthFactorInput
): CalculateHealthFactorResult {
  const {
    collateralValue,
    liquidationThreshold,
    debtValue
  } = input;

  if (collateralValue < 0) {
    return {
      ok: false,
      error: {
        code: 'NEGATIVE_COLLATERAL_VALUE',
        message: 'Collateral value cannot be negative.'
      }
    };
  }

  if (liquidationThreshold < 0 || liquidationThreshold > 1) {
    return {
      ok: false,
      error: {
        code: 'INVALID_LIQUIDATION_THRESHOLD',
        message: 'Liquidation threshold must be between 0 and 1.'
      }
    };
  }

  if (debtValue < 0) {
    return {
      ok: false,
      error: {
        code: 'NEGATIVE_DEBT_VALUE',
        message: 'Debt value cannot be negative.'
      }
    };
  }

  if (debtValue === 0) {
    return {
      ok: true,
      value: Number.POSITIVE_INFINITY,
      metadata: {
        formulaId: 'F-021'
      }
    };
  }

  const healthFactor =
    (collateralValue * liquidationThreshold) / debtValue;

  return {
    ok: true,
    value: healthFactor,
    metadata: {
      formulaId: 'F-021'
    }
  };
}
```

The exact Formula ID must match 02_FORMULAS.md.

---

# STANDARD RESULT TYPE

All public Engine functions should return a standardized result.

```ts
export type FormulaWarning = {
  code: string;
  message: string;
};

export type FormulaMetadata = {
  formulaId: string;
  assumptions?: string[];
  calculatedAt?: string;
};

export type FormulaError = {
  code: string;
  message: string;
};

export type FormulaResult<T> =
  | {
      ok: true;
      value: T;
      warnings?: FormulaWarning[];
      metadata: FormulaMetadata;
    }
  | {
      ok: false;
      error: FormulaError;
      metadata?: FormulaMetadata;
    };
```

This structure makes errors explicit.

It prevents invalid values from silently reaching the UI.

---

# DECIMAL PRECISION

JavaScript floating-point arithmetic can introduce small precision errors.

Example

```ts
0.1 + 0.2 !== 0.3
```

ProfitPilot must use a decimal arithmetic library for financial calculations where precision matters.

Recommended library

decimal.js

Alternative

big.js

Do not combine both libraries.

---

# DECIMAL BOUNDARY RULE

Convert incoming numeric values into Decimal objects at the Engine boundary.

Perform internal arithmetic using Decimal.

Convert results back to JavaScript numbers or strings only at the public output boundary.

Example

```ts
import Decimal from 'decimal.js';

const collateral = new Decimal(input.collateralValue);
const threshold = new Decimal(input.liquidationThreshold);
const debt = new Decimal(input.debtValue);

const healthFactor = collateral
  .mul(threshold)
  .div(debt);
```

---

# ROUNDING RULES

Never round during intermediate calculations unless a formula explicitly requires it.

Round only when

Returning an output that requires fixed precision.

Comparing against protocol precision.

Displaying a value in the UI.

Creating an export.

Rounding belongs primarily in formatting utilities, not formulas.

---

# RECOMMENDED OUTPUT PRECISION

BTC Quantity

8 decimal places

Currency Calculations

2 to 8 decimal places internally

Health Factor

At least 6 decimal places internally

Displayed Health Factor

2 decimal places

Percentages

At least 6 decimal places internally

Displayed Percentages

2 decimal places

APR

At least 6 decimal places internally

Timestamps

ISO 8601 format

Internal precision must always exceed display precision.

---

# PERCENTAGE REPRESENTATION

Percentages must use decimal form inside the Engine.

Examples

80 percent

```ts
0.8
```

5 percent APR

```ts
0.05
```

Never pass

```ts
80
```

when the Engine expects

```ts
0.8
```

Types and variable names should make this explicit.

Preferred

```ts
borrowAprDecimal
liquidationThresholdDecimal
maximumLtvDecimal
```

Avoid ambiguous names.

---

# MONEY REPRESENTATION

Version 1 may use Decimal objects internally and serialized decimal strings at storage boundaries.

Do not store money as binary floating-point values when exact persisted precision is important.

Preferred persistent representation

```text
"125000.50"
```

Avoid

```text
125000.5
```

when database transformations could alter precision.

---

# UNIT CONSISTENCY

Every formula must declare its units.

Examples

BTC

USD

Days

Years

Decimal Percentage

APR

Asset Quantity

Debt Value

Never combine values with incompatible units.

Bad

```ts
btcQuantity + debtUsd
```

Correct

```ts
btcQuantity.mul(btcPriceUsd)
```

before combining with USD-denominated debt.

---

# VARIABLE NAMING

Use unit-aware variable names.

Preferred

```ts
btcQuantity
btcPriceUsd
collateralValueUsd
debtValueUsd
holdingPeriodDays
borrowAprDecimal
```

Avoid

```ts
amount
value
rate
time
```

unless local context makes the unit unmistakable.

---

# FORMULA METADATA

Each Engine result should include its Formula ID.

For compound calculations, include all relevant Formula IDs.

Example

```ts
metadata: {
  formulaId: 'F-041',
  assumptions: [
    'Borrow APR remains constant.',
    'No additional collateral is added.',
    'No repayments occur during the period.'
  ]
}
```

Developer Mode may expose this metadata.

---

# ASSUMPTIONS

Every projection must explicitly declare assumptions.

Examples

Constant BTC Price

Constant Borrow APR

No Additional Borrowing

No Repayment

No Collateral Change

No Liquidation Penalty

No Slippage

No Gas Costs

No Tax Calculation

Assumptions must never remain hidden.

---

# WARNING SYSTEM

A calculation may be mathematically valid but still require a warning.

Examples

Stale price data.

Health Factor near liquidation.

Borrow APR unusually high.

Target Health Factor cannot be achieved.

Result depends on unsupported protocol parameters.

Warnings must not be treated as errors.

---

# ENGINE ERROR CATEGORIES

Validation Error

Input value is invalid.

Domain Error

The requested calculation is impossible.

Precision Error

A result exceeds supported precision.

Configuration Error

A required parameter is missing.

Invariant Error

An internal rule was violated.

Unexpected Error

A non-domain failure occurred.

Unexpected errors should be rare and logged outside the Engine.

---

# DEFENSIVE CALCULATION RULES

Before calculating

Validate all required values.

Reject NaN.

Reject undefined.

Reject negative values where impossible.

Reject percentages outside valid ranges.

Reject unsupported assets.

Reject zero denominators.

Reject invalid time periods.

Reject impossible portfolio states.

Do not allow malformed values to propagate.

---

# ENGINE INVARIANTS

The following must always remain true.

Portfolio value cannot be negative.

Debt cannot be negative.

BTC quantity cannot be negative.

Liquidation threshold must be between 0 and 1.

Maximum LTV must be between 0 and 1.

Maximum LTV must not exceed liquidation threshold.

APR must not be negative unless explicitly supported.

Holding period must not be negative.

Effective leverage must be at least 1 when equity is positive and no short exposure exists.

Repayment cannot exceed debt unless explicitly treated as full repayment.

A completed loop strategy must not finish below the configured minimum Health Factor.

---

# IMPLEMENTATION ORDER

The Engine must be built in dependency order.

Do not begin with the Recommendation Engine.

Do not begin with advanced simulations.

Recommended order follows.

---

# PHASE 1

Shared Types and Validation

Implement

Decimal utilities.

Formula result type.

Warnings.

Formula metadata.

Assertions.

Input schemas.

Protocol parameter validation.

Reason

Every later module depends on these foundations.

---

# PHASE 2

Portfolio Mathematics

Implement

Portfolio value.

Collateral value.

Debt value.

Net worth.

Equity ratio.

Debt ratio.

Effective leverage.

Gain and return.

Reason

Most features depend on basic portfolio values.

---

# PHASE 3

Aave Risk Mathematics

Implement

Maximum borrow.

Available borrow.

Loan-to-Value.

Health Factor.

Distance to liquidation.

Liquidation price.

Liquidation buffer.

Risk classification.

Reason

Risk calculations are central to Loop Builder, Dashboard, Exit Planner, and recommendations.

---

# PHASE 4

Interest Mathematics

Implement

Daily interest.

Monthly interest.

Annual interest.

Accrued debt.

Debt growth.

Break-even appreciation.

Future Health Factor.

Future liquidation price.

Time to target Health Factor.

Time to danger.

Reason

These formulas power the Position Timeline and long-term strategy analysis.

---

# PHASE 5

Loop Mathematics

Implement

Borrow capacity.

BTC purchased per loop.

Loop step calculation.

Recursive exposure.

Maximum loop count.

Target Health Factor loop strategy.

Interest-adjusted loop outcome.

Reason

Loop calculations depend on validated portfolio and risk formulas.

---

# PHASE 6

Scenario Simulation

Implement

BTC price scenarios.

APR scenarios.

Repayment scenarios.

Collateral addition scenarios.

Combined scenarios.

Scenario comparison.

Best case.

Worst case.

Break-even scenario.

Reason

Simulation combines portfolio, risk, liquidation, and interest modules.

---

# PHASE 7

Exit Planning

Implement

Target debt.

Required repayment.

BTC sale requirement.

Exit profit.

Capital preservation ratio.

Partial exit calculation.

Risk reduction efficiency.

Exit confidence.

Reason

Exit logic depends on completed portfolio, interest, and simulation calculations.

---

# PHASE 8

Recommendation Engine

Implement

Health Factor rules.

Debt ratio rules.

Interest cost rules.

Goal alignment.

Emergency recommendations.

Portfolio score.

Decision Card output.

Reason

Recommendations depend on nearly every previous module.

---

# TESTING PYRAMID

ProfitPilot uses four primary test levels.

Unit Tests

↓

Golden Reference Tests

↓

Integration Tests

↓

End-to-End Tests

Most tests should exist at the unit level.

---

# UNIT TESTS

Purpose

Verify one formula in isolation.

Each formula requires tests for

Normal values.

Boundary values.

Zero values.

Invalid values.

Extreme values.

Precision behavior.

Known examples from 02_FORMULAS.md.

Example

```ts
describe('calculateHealthFactor', () => {
  it('calculates the expected health factor', () => {
    const result = calculateHealthFactor({
      collateralValue: 100_000,
      liquidationThreshold: 0.8,
      debtValue: 40_000
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value).toBeCloseTo(2, 8);
    }
  });
});
```

---

# GOLDEN REFERENCE PORTFOLIO

The Golden Reference Portfolio defined in 02_FORMULAS.md must be implemented as a shared test fixture.

```text
tests/
└── golden/
    ├── referencePortfolio.ts
    ├── expectedPortfolioResults.ts
    ├── expectedRiskResults.ts
    ├── expectedInterestResults.ts
    ├── expectedLoopResults.ts
    └── expectedExitResults.ts
```

This portfolio provides known inputs and expected outputs across the entire Engine.

Any unexpected change to Golden Reference outputs must block release until reviewed.

---

# GOLDEN TEST PURPOSE

Golden tests detect

Formula drift.

Accidental rounding changes.

Dependency upgrades that alter calculations.

Refactoring errors.

Incorrect protocol parameter handling.

Cross-module inconsistencies.

Golden expected values must be reviewed manually before being updated.

AI agents must never automatically rewrite Golden expected values merely to make tests pass.

---

# BOUNDARY TESTS

Every percentage input should test

0

A normal value.

The maximum allowed value.

A value below 0.

A value above the maximum.

Every debt formula should test

No debt.

Very small debt.

Normal debt.

Debt equal to liquidation capacity.

Debt above liquidation capacity.

Every time formula should test

0 days.

1 day.

365 days.

Long holding periods.

Invalid negative periods.

---

# PROPERTY TESTS

Where practical, use property-based tests.

Recommended library

fast-check

Example properties

Increasing debt must not increase Health Factor.

Increasing collateral must not decrease Health Factor.

Increasing BTC price must not decrease collateral value for a long-only BTC portfolio.

Repaying debt must not increase liquidation risk.

Higher APR must not reduce projected debt.

Adding loops must not reduce gross BTC exposure.

The Engine should reject impossible state transitions.

---

# CROSS-FORMULA CONSISTENCY TESTS

Some formulas must agree with one another.

Examples

Net Worth

Equals

Portfolio Value minus Debt.

Equity Ratio plus Debt Ratio

Equals approximately 1.

Liquidation Distance

Must be consistent with current price and liquidation price.

Target Debt

Must produce the requested Health Factor within tolerance.

Full Debt Repayment

Must result in infinite or debt-free Health Factor behavior.

Zero Debt

Must produce zero interest cost.

These tests verify the Engine as a coherent system rather than isolated equations.

---

# REGRESSION TESTS

Every fixed financial bug must receive a permanent regression test.

Required process

Reproduce the bug.

Add a failing test.

Fix the implementation.

Confirm the test passes.

Keep the test permanently.

Never fix a formula bug without adding a test.

---

# ACCEPTABLE TOLERANCES

Exact decimal calculations should use exact equality where possible.

Derived floating-point outputs may use tolerances.

Recommended defaults

Currency

0.01 USD for displayed values.

BTC Quantity

0.00000001 BTC.

Health Factor

0.000001.

Percentages

0.000001.

Time Projection

0.01 days where applicable.

Each formula may define stricter tolerances.

---

# TEST NAMING

Test names should describe behavior.

Preferred

```ts
it('returns a lower health factor when debt increases')
```

Avoid

```ts
it('test 3')
```

Tests are part of the documentation.

---

# TEST DATA RULES

Use realistic but fictional portfolio data.

Do not use private user financial data.

Do not copy production portfolio values into test fixtures unless anonymized and intentionally approved.

Tests must remain reproducible.

---

# TEST EXECUTION

Local Development

```bash
npm run test
```

Watch Mode

```bash
npm run test:watch
```

Coverage

```bash
npm run test:coverage
```

End-to-End

```bash
npm run test:e2e
```

Full Validation

```bash
npm run validate
```

---

# VALIDATE COMMAND

The validation command should run

TypeScript type checking.

ESLint.

Formatting check.

Unit tests.

Golden tests.

Integration tests.

Production build.

Recommended script

```json
{
  "scripts": {
    "validate": "npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build"
  }
}
```

---

# COVERAGE TARGETS

Engine Statements

At least 95 percent.

Engine Branches

At least 90 percent.

Services

At least 85 percent.

UI Components

At least 70 percent.

Coverage numbers do not replace meaningful tests.

A test suite with high coverage and poor assertions is unacceptable.

---

# PERFORMANCE TESTS

Benchmark critical calculations.

Targets

Single portfolio calculation

Less than 10 milliseconds.

Optimal loop calculation

Less than 20 milliseconds.

Standard simulation

Less than 50 milliseconds.

Recommendation evaluation

Less than 20 milliseconds.

Performance tests should run using representative inputs.

Do not sacrifice correctness for small performance improvements.

---

# ENGINE VERSIONING

The Engine should expose a version.

```ts
export const ENGINE_VERSION = '1.0.0';
```

Saved exports and calculation reports should include the Engine version.

This enables future comparison when formulas or assumptions change.

---

# FORMULA VERSIONING

Material formula changes must document

Formula ID.

Previous behavior.

New behavior.

Reason for change.

Expected impact.

Migration considerations.

A formula change that alters existing outputs should increment the Engine minor or major version depending on impact.

---

# CHANGE CONTROL

Changes that require explicit review

Health Factor formula.

Liquidation formula.

Loop optimization.

Interest accrual.

Exit calculations.

Recommendation thresholds.

Portfolio score weights.

Golden reference values.

Protocol assumptions.

AI agents may propose these changes.

They must not silently implement them.

---

# AI IMPLEMENTATION RULES

AI coding agents must

Read the relevant Formula IDs before coding.

Implement one formula module at a time.

Create tests before or alongside implementation.

Use Decimal arithmetic where required.

Preserve unit-aware naming.

Return standardized results.

Add Formula IDs to metadata.

Document assumptions.

Run validation before declaring completion.

Never duplicate a formula.

Never change expected outputs only to satisfy tests.

Never hide invalid inputs with default values.

Never round intermediate results.

---

# DEFINITION OF DONE

A Formula Engine function is complete only when

Its Formula ID is documented.

Its input and output types exist.

Its units are explicit.

Its validation rules are implemented.

Its assumptions are documented.

Its happy-path tests pass.

Its boundary tests pass.

Its invalid-input tests pass.

Its Golden Reference tests pass where applicable.

Its public export exists.

Its documentation is updated.

No TypeScript or lint errors remain.

---

# ACCEPTANCE CRITERIA

✓ Formula Engine structure is defined.

✓ Decimal precision strategy is established.

✓ Percentage and unit conventions are documented.

✓ Standard result and error models are defined.

✓ Formula implementation order is established.

✓ Golden Reference testing is mandatory.

✓ Boundary, property, consistency, and regression tests are required.

✓ Coverage and performance targets are defined.

✓ Formula and Engine versioning are documented.

✓ AI agents cannot silently alter core financial behavior.

---

END OF PAGE 6

NEXT

Page 7

Frontend Implementation, Components, Forms & Responsive Behavior

# 04_BUILD_GUIDE

Project

ProfitPilot

Page

8 of 10

Title

Authentication, Data Persistence, Import & Export

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

Pages 1–7

---

# PURPOSE

This chapter defines how ProfitPilot stores user data, synchronizes information, and imports or exports portfolios.

Version 1 prioritizes simplicity.

The application must work without requiring an online account.

Cloud synchronization is an optional enhancement.

---

# DATA STORAGE PHILOSOPHY

ProfitPilot stores only information necessary to reproduce calculations.

The Engine never stores data.

It only calculates results.

Persistent storage belongs to the data layer.

---

# STORAGE LEVELS

ProfitPilot supports three storage levels.

Local Storage

↓

Supabase Cloud

↓

Export Files

Users should always retain ownership of their portfolio data.

---

# LOCAL STORAGE

Default storage method.

Advantages

No account required.

Works offline.

Fast.

Private.

Stores

Portfolio

Settings

Saved Simulations

Saved Exit Plans

Developer Preferences

Local storage should be automatically loaded when the application starts.

---

# CLOUD STORAGE

Optional.

Powered by Supabase.

Benefits

Multiple devices.

Automatic backup.

Multi-portfolio management.

Future collaboration features.

Cloud synchronization should never be required to use ProfitPilot.

---

# AUTHENTICATION

Version 1 authentication is optional.

Supported

Email

Password

Future

Google

GitHub

Wallet Authentication

Anonymous users may continue using the application locally.

---

# USER ACCOUNTS

Each account owns

Multiple Portfolios

Settings

Saved Simulations

Saved Exit Plans

Export History (Future)

All user data is isolated using Row Level Security.

---

# DATA SYNCHRONIZATION

Priority

Cloud

↓

Local Cache

↓

Manual Import

If synchronization fails

Continue using local data.

Display a synchronization warning.

Never prevent calculations.

---

# IMPORT

Supported Formats

JSON

Future

CSV

Users can import

Portfolio

Simulation

Settings

Exit Plans

Imported data must pass validation before being accepted.

---

# EXPORT

Supported Formats

JSON

CSV

PDF Report (Future)

Exports should include

Portfolio

Current Position

Simulation Results

Recommendations

Timestamp

Engine Version

Formula Version

This ensures exported results remain reproducible.

---

# IMPORT VALIDATION

Every imported file must verify

Required fields

Supported version

Numeric ranges

Portfolio integrity

Unknown fields should be ignored when safe.

Invalid files should produce clear error messages.

---

# VERSION COMPATIBILITY

Every export includes

Application Version

Engine Version

Formula Version

Export Timestamp

Future versions should detect incompatible exports and explain any required migration.

---

# AUTO SAVE

ProfitPilot automatically saves

Portfolio changes

Simulation settings

Application preferences

Auto-save should occur after meaningful changes.

No manual save button is required for local storage.

---

# BACKUPS

Cloud users benefit from automatic backups.

Local users can create manual exports.

ProfitPilot should never delete user portfolios automatically.

---

# DATA RECOVERY

If local storage becomes corrupted

Attempt recovery from

Cloud

↓

Manual Backup

↓

Empty Portfolio

Recovery actions should always require user confirmation.

---

# PRIVACY

ProfitPilot stores only information required for portfolio management.

Never store

Private Keys

Seed Phrases

Wallet Recovery Phrases

Exchange Credentials

Sensitive financial information should remain under the user's control.

---

# IMPORT / EXPORT DIRECTORY

```text
services/
├── import/
│   ├── ImportService.ts
│   ├── ImportValidator.ts
│   └── schemas.ts
│
├── export/
│   ├── ExportService.ts
│   ├── JsonExporter.ts
│   ├── CsvExporter.ts
│   └── PdfExporter.ts
```

---

# IMPLEMENTATION ORDER

1.

Local Storage

2.

JSON Import

3.

JSON Export

4.

Supabase Authentication

5.

Cloud Synchronization

6.

CSV Export

7.

PDF Reports

Future features should not delay Version 1.

---

# ACCEPTANCE CRITERIA

✓ Application works without an account.

✓ Local storage implemented.

✓ Optional cloud synchronization supported.

✓ Multi-portfolio persistence supported.

✓ JSON import and export implemented.

✓ Import validation completed.

✓ Automatic saving enabled.

✓ User privacy protected.

---

END OF PAGE 8

NEXT

Page 9

Development Workflow, AI Coding Standards & Quality Assurance

# 04_BUILD_GUIDE

Project

ProfitPilot

Page

9 of 10

Title

Development Workflow, AI Coding Standards & Quality Assurance

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

Pages 1–8

---

# PURPOSE

This chapter defines the development workflow for ProfitPilot.

Its goal is to ensure that every feature is implemented consistently, whether developed by a human or an AI coding agent.

The workflow prioritizes correctness, documentation, testing and maintainability over development speed.

---

# DEVELOPMENT PHILOSOPHY

ProfitPilot is developed incrementally.

Every completed feature should leave the application in a working state.

Avoid large rewrites.

Avoid unfinished features.

Prefer many small improvements over one large implementation.

---

# FEATURE DEVELOPMENT PROCESS

Every feature follows the same workflow.

1.

Read Documentation

↓

2.

Design Solution

↓

3.

Implement Engine

↓

4.

Implement Service

↓

5.

Implement UI

↓

6.

Write Tests

↓

7.

Review

↓

8.

Merge

No step should be skipped.

---

# DOCUMENTATION FIRST

Before implementing any feature, review

README.md

Product goals

↓

01_PRD.md

Requirements

↓

02_FORMULAS.md

Financial calculations

↓

03_UI.md

User interface

↓

04_BUILD_GUIDE.md

Engineering standards

Code should follow documentation.

Documentation should not follow code.

---

# IMPLEMENTATION ORDER

Every feature should be built from the inside out.

Engine

↓

Services

↓

State

↓

UI

↓

Testing

↓

Documentation

Never begin with visual styling before the business logic exists.

---

# BRANCH STRATEGY

Recommended branch naming

feature/dashboard

feature/loop-builder

feature/simulation

feature/export

bugfix/health-factor

bugfix/import-validation

refactor/portfolio-service

docs/formulas

One branch should contain one primary objective.

---

# COMMIT STYLE

Recommended format

```text
feat: add portfolio summary cards

fix: correct Health Factor calculation

refactor: simplify Simulation Service

test: add Golden Reference tests

docs: update Build Guide

style: improve dashboard spacing
```

Commit messages should clearly explain the change.

---

# PULL REQUEST CHECKLIST

Before merging

✓ Documentation reviewed

✓ Feature implemented

✓ Tests added

✓ TypeScript passes

✓ Lint passes

✓ Build succeeds

✓ No duplicated logic

✓ UI matches specification

✓ Formula IDs verified

---

# AI DEVELOPMENT RULES

AI coding agents should

Read documentation before writing code.

Implement one feature at a time.

Prefer existing components over creating new ones.

Avoid unnecessary libraries.

Keep files focused.

Explain significant architectural decisions.

Preserve existing behavior during refactoring.

Never silently modify financial formulas.

---

# CODE REVIEW PRINCIPLES

Every review should answer

Is the feature correct?

Is it understandable?

Is it documented?

Is it tested?

Can it be simplified?

Good code is easy to read six months later.

---

# REFACTORING RULES

Refactoring should

Improve readability

Reduce duplication

Simplify structure

Improve maintainability

Refactoring should not

Change business behavior

Change Formula outputs

Introduce hidden side effects

Every refactor should leave existing tests passing.

---

# TESTING REQUIREMENTS

Every completed feature requires

Unit Tests

Integration Tests (where applicable)

Regression Tests (for bug fixes)

End-to-End Tests (for critical user flows)

Tests are part of the feature.

A feature without tests is incomplete.

---

# BUG FIX WORKFLOW

When a bug is discovered

1.

Reproduce the issue

↓

2.

Write a failing test

↓

3.

Implement the fix

↓

4.

Verify tests pass

↓

5.

Review the solution

↓

6.

Merge

Every bug should result in a permanent regression test.

---

# RELEASE CHECKLIST

Before releasing

✓ Application builds successfully

✓ All tests pass

✓ Documentation updated

✓ No known critical bugs

✓ Version number updated

✓ Release notes prepared

A release should always be reproducible.

---

# VERSIONING

Use Semantic Versioning.

Major

Breaking changes

Minor

New features

Patch

Bug fixes

Examples

1.0.0

Initial Release

1.1.0

Simulation Improvements

1.1.3

Health Factor Bug Fix

---

# CHANGE LOG

Maintain a CHANGELOG.md.

Each release should include

New Features

Improvements

Bug Fixes

Breaking Changes

Known Issues

This provides a clear project history.

---

# DEFINITION OF DONE

A feature is complete when

Documentation is consistent.

Business logic is implemented.

UI is functional.

Tests pass.

No TypeScript errors remain.

No lint errors remain.

No duplicated logic exists.

Code review is complete.

The application builds successfully.

---

# AI REVIEW CHECKLIST

Before declaring a task complete, AI should verify

Did I follow the documentation?

Did I reuse existing code?

Did I duplicate any logic?

Did I add tests?

Did I preserve Formula behavior?

Did I keep the implementation simple?

Could another developer understand this tomorrow?

If any answer is "No", continue improving the implementation.

---

# FUTURE DEVELOPMENT

Potential future modules

Ethereum Support

Multiple Lending Protocols

Historical Analytics

Mobile Application

Portfolio Sharing

Tax Reporting

AI Strategy Assistant

The architecture should support future growth without requiring major rewrites.

---

# PROJECT PRINCIPLES

ProfitPilot values

Accuracy

Transparency

Maintainability

Simplicity

User Ownership

Financial Safety

Every development decision should reinforce these principles.

---

# ACCEPTANCE CRITERIA

✓ Development workflow documented.

✓ Feature implementation order defined.

✓ AI coding standards established.

✓ Code review process documented.

✓ Testing workflow defined.

✓ Bug fix process established.

✓ Release checklist created.

✓ Semantic versioning adopted.

✓ Definition of Done documented.

---

END OF PAGE 9

NEXT

Page 10

Deployment, Production Readiness & Project Completion

# 04_BUILD_GUIDE

Project

ProfitPilot

Page

10 of 10

Title

Deployment, Production Readiness & Version 1 Completion

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

Pages 1–9

---

# PURPOSE

This chapter defines how ProfitPilot is prepared for production deployment and establishes the completion criteria for Version 1.0.

The objective is to ensure that Version 1 is stable, maintainable, reproducible, and ready for daily personal use.

Version 1 is considered complete when every requirement defined in this documentation has been implemented and verified.

---

# DEPLOYMENT PHILOSOPHY

Deploy small.

Deploy often.

Deploy stable.

Every deployment should leave the application in a usable state.

Avoid large "big bang" releases.

Every deployment should be reversible.

---

# DEPLOYMENT PLATFORM

Primary Platform

Vercel

Future Options

Docker

Self Hosted

Cloudflare

Netlify

The application should remain portable and avoid vendor lock-in whenever practical.

---

# ENVIRONMENT CONFIGURATION

Supported environments

Development

↓

Testing

↓

Production

Each environment should use its own configuration.

Sensitive information must always be supplied through environment variables.

---

# REQUIRED ENVIRONMENT VARIABLES

Examples

```text
NEXT_PUBLIC_APP_NAME

NEXT_PUBLIC_DEFAULT_CURRENCY

SUPABASE_URL

SUPABASE_ANON_KEY

SENTRY_DSN

COINGECKO_API_KEY (Future)
```

Every required variable should be documented inside

.env.example

---

# BUILD PROCESS

Before deployment

↓

Install Dependencies

↓

Type Check

↓

Lint

↓

Run Tests

↓

Production Build

↓

Deploy

↓

Health Check

↓

Ready

Every deployment should pass this pipeline.

---

# DEPLOYMENT CHECKLIST

Before every release

✓ TypeScript passes

✓ ESLint passes

✓ Build succeeds

✓ Engine tests pass

✓ UI tests pass

✓ Golden Reference tests pass

✓ Documentation updated

✓ Environment variables verified

✓ Version updated

✓ CHANGELOG updated

No deployment should skip this checklist.

---

# PRODUCTION MONITORING

Monitor

Application Errors

Performance

Availability

Failed Synchronizations

Unexpected Exceptions

Monitoring should help detect problems without collecting unnecessary personal financial information.

---

# BACKUP STRATEGY

Cloud Users

Automatic database backups.

Local Users

JSON export.

Future

Encrypted cloud backups.

Users should always be able to recover their portfolio.

---

# DISASTER RECOVERY

If cloud services fail

↓

Continue using local portfolio.

↓

Display synchronization warning.

↓

Retry automatically.

↓

Allow manual export.

External failures should not prevent portfolio analysis.

---

# SECURITY CHECKLIST

Before Version 1

✓ HTTPS only

✓ Environment variables secured

✓ Row Level Security enabled

✓ Input validation complete

✓ No secrets committed

✓ No private keys requested

✓ No wallet signing

✓ Dependency audit completed

ProfitPilot Version 1 is a read-only financial planning application.

---

# PERFORMANCE TARGETS

Initial Page Load

Less than 2 seconds

Dashboard Refresh

Less than 100 milliseconds

Simulation Update

Less than 50 milliseconds

Loop Strategy

Less than 20 milliseconds

Export

Less than 5 seconds

Performance should support a smooth user experience on modern hardware.

---

# DOCUMENTATION COMPLETION

Version 1 documentation should include

README

01_PRD

02_FORMULAS

03_UI

04_BUILD_GUIDE

05_AI_PROMPTS

06_TASKS

Every document should remain synchronized with the application.

Documentation is part of the product.

---

# CODE QUALITY

Version 1 should maintain

Strict TypeScript

Minimal duplication

Consistent naming

Reusable components

Small focused modules

Clear documentation

Predictable architecture

Readable code is preferred over clever code.

---

# USER EXPERIENCE CHECKLIST

The user can

Create a portfolio.

Manage multiple portfolios.

Enter collateral and debt.

Calculate Health Factor.

View liquidation price.

Run simulations.

Generate loop strategies.

Generate exit plans.

Receive recommendations.

Export portfolio data.

Switch between manual and cloud storage.

Use the application without programming knowledge.

---

# VERSION 1 FEATURE CHECKLIST

Dashboard

✓

Portfolio Management

✓

Simulation Workspace

✓

Loop Builder

✓

Exit Planner

✓

Recommendation Engine

✓

Manual Mode

✓

Developer Mode

✓

Import / Export

✓

Multi-Portfolio Support

✓

Settings

✓

Responsive Interface

✓

Accessibility

✓

---

# FUTURE ROADMAP

Potential Version 2

Ethereum

Additional Lending Protocols

Historical Portfolio Tracking

Portfolio Performance Charts

AI Strategy Assistant

Wallet Synchronization

Tax Reports

Notification Center

These features should not delay Version 1 completion.

---

# VERSION 1 DEFINITION OF DONE

ProfitPilot Version 1 is complete when

All Formula IDs are implemented.

All documented features exist.

The Engine passes all tests.

The application builds successfully.

Documentation matches implementation.

The interface matches the UI specification.

Manual Mode functions without cloud services.

Cloud synchronization functions correctly.

Import and export work correctly.

No known critical defects remain.

The application is reliable enough for daily personal use.

---

# VERSION 1 DEFINITION OF EXCELLENCE

Version 1 is considered excellent when

The codebase is easy to understand.

New features integrate naturally.

Documentation remains accurate.

Financial calculations are deterministic.

Performance is consistently responsive.

The application inspires confidence.

Users understand why every recommendation is made.

Complex financial concepts are presented simply.

---

# FINAL ENGINEERING PRINCIPLES

Every decision should support

Correctness

Transparency

Maintainability

Predictability

User Ownership

Financial Safety

ProfitPilot is not designed to maximize activity.

It is designed to improve decision making.

---

# FINAL PROJECT MISSION

ProfitPilot exists to help investors understand leveraged Bitcoin positions with clarity.

Every calculation should be explainable.

Every recommendation should be transparent.

Every interface should reduce complexity.

The application should empower users to make informed financial decisions while maintaining full ownership of their data.

---

# BUILD GUIDE COMPLETION

This document defines

Technology Stack

Architecture

Repository Structure

Development Standards

Formula Engine Design

Frontend Standards

Data Management

Security

Development Workflow

Deployment

Version 1 Completion

Together with the Product Requirements Document, Formula Specification, and UI Specification, it provides a complete engineering blueprint for building ProfitPilot.

---

# ACCEPTANCE CRITERIA

✓ Technology stack defined.

✓ Architecture documented.

✓ Repository structure established.

✓ Formula Engine implementation standards completed.

✓ Frontend implementation standards completed.

✓ Data persistence documented.

✓ Security requirements documented.

✓ Development workflow established.

✓ Deployment process defined.

✓ Version 1 completion criteria documented.

✓ Engineering philosophy finalized.

---

END OF DOCUMENT

04_BUILD_GUIDE.md

Version 1.0 Complete
