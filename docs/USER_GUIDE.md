# ProfitPilot User Guide

`06_TASKS.md` M9-053 ("Audit User Documentation") — Milestone 9 Batch 10.
This is the first real, dedicated user-facing guide this project has
had. `README.md` at the repository root is the original AI project
specification (`Document Type: AI Project Specification`, `Primary
Audience: AI Coding Agents`) — a frozen planning document, not a guide
for someone actually using the application; it is deliberately left
unmodified (`.prettierignore`'s own "Specification documents" exclusion
covers it, the same treatment every `docs/0X_*.md` spec file gets).
This document describes ProfitPilot **as it actually exists today**,
verified against the real implementation, not the original plan.

## What ProfitPilot is

ProfitPilot is a personal decision-support tool for managing a
Bitcoin-collateralized leverage position on Aave. It calculates your
Health Factor, Loan-to-Value, liquidation price, borrowing cost, and
suggested actions from numbers you enter yourself.

**What it is not**: ProfitPilot does not connect to a wallet and does
not execute any transaction on your behalf — nothing here can ever
sign or submit anything to a real Aave position, on V3 or V4. Nothing
you do inside ProfitPilot changes your real position on Aave — every
"Borrow," "Repay," "Loop," or "Exit" action inside the app only
updates the numbers you are tracking locally. It is not financial
advice, and every suggested action is a calculation you should verify
yourself before acting on it in the real world.

This is **Version 1.0.0 — Manual Mode**: "Manual Mode" describes
ProfitPilot needing no backend service configured to run (`01_PRD.md`'s
own REQ-010) — not, as this section previously implied, an absence of
live data. Reading your real Aave *position* directly by connecting a
wallet remains Version 2 scope (`docs/VERSION_2_BACKLOG.md`'s "Live
portfolio imports"), not something this version does by accident or on
purpose.

**Live data, read-only, distinct from position size.** BTC price and
Aave V3 protocol parameters (max LTV, liquidation threshold, borrow/supply
APR) are fetched live and read-only by default, with no setup required —
ProfitPilot reads these directly from Aave V3's own on-chain contracts.
If you opt in to Aave V4 for a portfolio by entering an on-chain
address, ProfitPilot also reads that position's real, live debt state,
collateral risk factor, and base drawn interest rate the same way —
read-only, no wallet connection, no signing. Aave V4 can be chosen
either when you create a portfolio or afterward on an existing one.
What stays manual, always: your collateral
quantity and debt balance — only you enter and update your own position
size; ProfitPilot never infers or fetches it. If a live V4 value you
opted into differs from a manual entry you made, you choose whether to
adopt the live value or keep your own — never silently overwritten. A
live fetch can fail (e.g. the RPC provider is unreachable); ProfitPilot
then keeps showing your last known value rather than blanking it, and
labels it accordingly. This is not a live price *feed* in the
continuous-streaming sense — it refreshes when you load the page or
press refresh, not automatically in the background.

## Getting started

1. Open the application — the **Dashboard** (`/`) is the landing page.
2. If you have no portfolio yet, you'll be prompted to create one —
   or go to **Portfolios** → **Create Portfolio**.
3. Enter your collateral (BTC quantity), debt (borrowed amount and
   asset), and the current BTC price and Aave protocol parameters for
   your position.
4. The Dashboard immediately shows your Health Factor, Loan-to-Value,
   liquidation price, and other core metrics — recalculated instantly
   from whatever you just entered, with no page reload.

Nothing is required to get started beyond entering your own numbers —
no account, no wallet connection, no API key. See "Optional accounts"
below for what Sign In actually does, since it is never required.

## The 7 tools, in the order the sidebar presents them

Each tool exists to answer one specific question (the sidebar shows
this question under each label):

| Tool | Route | Question it answers |
| --- | --- | --- |
| **Dashboard** | `/` | "Am I safe?" |
| **Portfolio** | `/portfolio` | "What do I own?" |
| **Simulation** | `/simulation` | "What happens if...?" |
| **Loop Builder** | `/loop-builder` | "How much leverage should I use?" |
| **Exit Planner** | `/exit-planner` | "What should I do now?" |
| **Recommendations** | `/recommendations` | "What actions are suggested?" |
| **Settings** | `/settings` | "How do I customize the application?" |

(`/portfolios` — plural — is the portfolio list/switcher, reachable from
the Portfolio tool; it is where you create, duplicate, archive, or
delete a portfolio.)

### Dashboard

Your portfolio's own key numbers at a glance: Health Factor, Loan-to-Value,
liquidation price, net worth, and a Data Freshness section showing when
your manually-entered price/parameters were last updated (there is no
live feed to compare against — this is purely "how long ago did *you*
last update this," not a live-market staleness check). If a calculation
cannot be produced for your current numbers (e.g. an impossible input
combination), an error banner explains what failed and confirms your
underlying data is unchanged — see "If something goes wrong" below.

### Portfolio

Where you edit your collateral, debt, and manual price/protocol
parameters. Every parameter shown here is clearly labeled by its
source — a manually-entered value is never presented as if it came from
a live feed. This is also where portfolio duplication, archiving, and
deletion live (via the Portfolios list).

### Simulation

"What happens if...?" — build a hypothetical scenario (a BTC price
change, a collateral/debt change, an interest-rate/holding-period
change) and see the projected outcome side-by-side with your current
position, without touching your real tracked numbers. Save scenarios to
compare later, export them, or reload one to see how your real position
has drifted since you saved it.

### Loop Builder

Models a leverage loop (repeated borrow-and-add-collateral cycles) and
shows the resulting Health Factor, effective leverage, and interest
cost at each step — stopping automatically if a step would breach your
own minimum Health Factor or the protocol's own borrowing limits. This
is the one tool where increasing leverage is the explicit point, so
read the Health Factor and liquidation-distance figures at every step
before treating a loop plan as something you'd actually do — a lower
Health Factor after looping means less room before liquidation, not a
theoretical concern.

### Exit Planner

"What should I do now?" — models reducing or fully closing your
position: how much BTC you'd need to sell, how much debt you'd repay,
and the resulting numbers, given a target you choose.

### Recommendations

Rule-based suggestions (Borrow, Repay, Add Collateral, Loop) generated
from your current numbers against a target you set — never an opaque,
unexplained suggestion. Each one names its own reasoning. These are
advisory only: nothing here executes automatically, and nothing here
is a guarantee of a specific outcome — see "How to read a
recommendation" below.

### Settings

Export/import your data, manage Recovery Snapshots, clear local data,
and (if you've configured it) sign in. See "Your data" and "Optional
accounts" below.

## How to read a recommendation

Every recommendation names a reason, tied to your own current numbers
— never a generic "you should repay debt" with no explanation. Treat a
recommendation as a starting point for your own decision, not an
instruction: ProfitPilot has no way to know about your full financial
situation, tax consequences, or anything happening outside the numbers
you've entered into it.

## Understanding risk indicators

Health Factor, Loan-to-Value, and liquidation distance are always shown
as plain numbers with a text label — never conveyed by color alone.
Values derived from a calculation (a simulation result, a projected
exit outcome, a loop step's own resulting Health Factor) are computed
from the inputs you gave, using the same formulas throughout the
application — they are only as accurate as the numbers you entered, and
none of them account for real-world factors ProfitPilot has no way to
know about (slippage, gas costs, a real liquidation's own execution
mechanics on Aave).

## Your data

Everything you enter lives in your browser's own local storage — there
is no server holding a copy of it, and it is never sent anywhere on
its own. Two things do leave your browser by default, neither of them
your portfolio data: a read-only Aave price/parameter request (see
"Live data, read-only" above — the request itself, not your entered
collateral/debt amounts, reaches a third-party RPC provider), and,
only if a deployer explicitly configures it, error monitoring (see
"Optional observability" below, off by default). This means:

- **Your data does not follow you to a different browser or device.**
  If you switch browsers, clear your browser data, or move to a new
  device, your portfolios do not come with you automatically.
- **Export regularly.** `/settings` → **Export** → **Full Backup**
  downloads everything as a single file. This is the only way to move
  your data to another browser/device, and the only real protection
  against browser data being cleared (by you, by the browser itself
  under storage pressure, or by ending a private-browsing session).
- **Import** (`/settings` → **Import**) restores from a previously
  exported file, or merges it into your current data — you choose how:
  **Add as new** (every record added under a new id, even if it
  conflicts), **Merge non-conflicting** (adds records with no local
  match, skips anything conflicting), **Replace selected** (replaces
  only the conflicting records you pick), or **Replace all local data**
  (clears everything and replaces it with only the file's contents —
  the one option requiring an extra, explicit confirmation checkbox,
  since it's the only one that can't be narrowly undone by itself).
- **Recovery Snapshots** (`/settings` → **Recovery Snapshots**) are
  taken automatically right before a **Replace selected** or **Replace
  all local data** import — if an import goes wrong, restore the
  snapshot from just before it. An ordinary Delete of a single record
  has no automatic snapshot — see "Limitations" below.
- **Clear Local Data** (`/settings`) permanently erases everything in
  this browser profile, after an explicit confirmation. Export a backup
  first if there's anything you want to keep.

## Optional accounts

Signing in is never required — every feature above works with no
account at all. If a deployer has configured Supabase, Sign In/Sign Up
lets you authenticate, but **this does not sync, back up, or store any
portfolio data in the cloud** — Cloud Sync and Cloud Database were
cancelled as a product decision and are not part of this application in
any version. An account today does nothing beyond authenticate; nothing
about how your portfolio data is stored changes whether you're signed
in or not. In this application's own default configuration (no
Supabase project set up), Sign In/Sign Up simply report that cloud
accounts aren't available — this is the expected state, not an error.

## Optional observability

If a deployer has configured Sentry (error monitoring), the application
can report an unexpected crash to help diagnose it. This is off by
default and does not send your portfolio numbers, balances, or any
financial data — see `docs/OBSERVABILITY.md` for the full technical
detail if you're curious. Most users, including anyone running this
application's default configuration, will never have this active at
all.

## Limitations

- **Collateral quantity and debt balance are always manual.** Live data
  covers price and protocol parameters (and, opted into V4, debt
  state/collateral risk) — never your position size; you enter and
  update that yourself.
- **Refresh is on page load, not continuous.** Live values update when
  you open or reload a page, or press refresh — not automatically in
  the background while you're looking at it.
- **No cloud backup.** Your only backup is a file you export yourself.
- **Deleting a single record is permanent.** Unlike a bulk import
  replace, an ordinary Delete (a portfolio, a saved strategy) has no
  automatic snapshot beforehand — Archive a portfolio instead of
  deleting it if you might want it back later; Archive is fully
  reversible, Delete is not.
- **Your data does not follow you across browsers or devices** without
  an explicit export/import.
- **This is not financial advice**, not a trading system, and does not
  execute any real transaction.

## Troubleshooting

- **"I lost data / something looks wrong after an import or update."**
  See `docs/DISASTER_RECOVERY.md` for the full, honest breakdown of
  what can be recovered and how — Recovery Snapshots and a previously
  exported backup are the two real recovery paths this application has.
- **"A page shows an unexpected error screen."** It will show a short
  reference code — your data is stored separately from the page itself
  and is unaffected by a page-level error. Use "Try again," or navigate
  back to the Dashboard from the error screen.
- **"Sign In says cloud accounts aren't available."** This is expected
  in the default configuration — see "Optional accounts" above. It does
  not affect anything else in the application.
- **"My portfolio isn't on this device/browser."** See "Your data"
  above — export a backup from wherever it currently lives, then import
  it here.
