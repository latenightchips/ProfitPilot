# Version 2 Backlog

`06_TASKS.md` M10-023 ("Create Version 2 Backlog") — Milestone 10 Batch
5. Dependencies: M10-022 (`docs/TECHNICAL_DEBT.md`). Description:
"Prepare the initial roadmap." Potential items (verbatim from
`06_TASKS.md`, not invented here): Additional protocols, Wallet
integrations, Live portfolio imports, Advanced simulations, Portfolio
analytics, Tax reporting, AI insights, Mobile application. DoD:
"Version 2 work is prioritized without affecting Version 1 stability."

**What this document is and is not.** This is a draft, evidence-based
prioritization of the eight items `06_TASKS.md` itself already names as
Version 2 candidates — it is **not** a committed roadmap, a scheduled
release plan, or a product decision on what actually gets built. Which
items ship, in what order, and on what timeline remains an owner
decision this document does not make. "Without affecting Version 1
stability" is satisfied trivially: this batch touches no application
code, no `engine/` file, and no version constant — Version 1.0.0's
scope freeze (`CONTRIBUTING.md`) is completely unaffected.

Every item below already appears in this project's existing record —
`01_PRD.md`'s own repeated "belongs to Version 2" framing, and the 33
of 69 Formula IDs already deferred with a recorded reason (Conflicts
#5, #7, #8, #9, #10, #11, #12, #15, `PROJECT_STATUS.md`). This document
organizes that existing evidence into a priority order; it does not
introduce new scope.

## Priority order (evidence-based draft, not a commitment)

Each candidate below is broken into four distinct fields, kept
deliberately separate so a reader never conflates "this is technically
ready" with "this is approved": **Candidate** (verbatim from
`06_TASKS.md`), **Priority tier** (this document's own draft ranking),
**Rationale / dependencies** (why this tier, and what it depends on),
and **Owner decision required before implementation** (what a product
owner must still decide — every single item has at least one).

### 1. Additional protocols

- **Priority tier**: Highest.
- **Rationale / dependencies**: Version 1.0.0 supports exactly one
  protocol (Aave V3, `01_PRD.md`'s own "Version 0.1 focuses exclusively
  on... the Aave V3 lending protocol"). The Engine's own protocol
  parameters are already isolated from its formulas
  (`docs/04_BUILD_GUIDE.md`'s architecture, `services/protocol/`) — the
  most architecturally-prepared item on this list. No dependency on
  another item below.
- **Owner decision required**: which protocol(s) to add, and whether
  each one's own formulas justify the same Golden-Reference-Portfolio
  verification rigor `docs/QUALITY_PLAN.md` already requires for Aave
  V3 (real, large effort, independently, per protocol) before work
  begins.

### 2. Advanced simulations

- **Priority tier**: High.
- **Rationale / dependencies**: builds directly on the existing
  Simulation Workspace (Milestone 6) rather than new infrastructure —
  multi-scenario batches, wider parameter sweeps, or the compound-
  interest/multi-asset formulas already deferred (Conflicts #7, #8,
  #11) are natural extensions of a tool that already exists and is
  already tested. No dependency on another item below.
- **Owner decision required**: which specific deferred formulas
  (compound interest, multi-asset collateral, others) to prioritize
  first, and whether any require their own new specification content
  beyond what Conflicts #7/#8/#11 already scoped as out-of-scope for
  Version 1.

### 3. Portfolio analytics

- **Priority tier**: High.
- **Rationale / dependencies**: historical trend views over a
  portfolio's own saved states — `recharts` is already a direct
  dependency (`package.json`), already used for existing
  visualizations. No live/external data source required — built
  entirely from data the application already persists. No dependency
  on another item below.
- **Owner decision required**: what analytics are actually wanted (a
  net-worth-over-time chart is a very different scope commitment from
  a full historical-performance dashboard) — this document does not
  presume either.

### 4. Wallet integrations

- **Priority tier**: Medium — a prerequisite for "Live portfolio
  imports" below, not an end in itself.
- **Rationale / dependencies**: a genuine architectural and security-
  surface expansion — real on-chain read access where none exists
  today. `docs/SECURITY_THREAT_MODEL.md`'s own 9 named threats were
  scoped against a no-wallet, manual-entry application; a wallet
  integration needs its own threat-model extension, not an assumption
  the existing model already covers it. Sequenced before item 5, which
  depends on it.
- **Owner decision required**: whether wallet-based read access is
  wanted at all, and if so which wallet standard(s)/chains to support —
  a real product-scope decision, not an engineering default. **This
  item is on-chain read access to a user's own wallet — it is not, and
  must not be read as, a proposal to reintroduce Cloud Database or
  Cloud Synchronization.** Those remain cancelled by explicit product
  decision (Milestone 8, `docs/MILESTONE_8_SCOPE_CHANGE.md`); nothing
  in this document reopens or reverses that decision. Any future work
  in this area, or any other capability that would touch a
  cloud-backed store, is new Version 2 scope requiring its own explicit
  approval — not an extension of an already-cancelled Version 1
  capability.

### 5. Live portfolio imports

- **Priority tier**: Medium, sequenced after item 4.
- **Rationale / dependencies**: reading a real Aave position directly,
  rather than manual entry — the single largest change to this
  application's own stated identity (`docs/USER_GUIDE.md`'s "What
  ProfitPilot is not": "does not read your real Aave position").
  Depends on item 4 (wallet integrations).
- **Owner decision required**: whether this application's own core
  identity as a manual-entry, decision-support tool (not a live wallet
  reader) should change at all — this is a product-identity decision,
  not just a scoping question, and is not made by listing the item
  here.

### 6. Mobile application

- **Priority tier**: Lower.
- **Rationale / dependencies**: Version 1.0.0 is already a responsive
  web application, tested and verified down to a 375px mobile viewport
  with dedicated mobile-specific e2e coverage (`docs/QUALITY_PLAN.md`
  §4, Milestone 9 Batch 4's own "interactive mobile/tablet workflows"
  closure) — a materially different, large undertaking layered on top
  of an already-functioning mobile experience. No dependency on another
  item below.
- **Owner decision required**: whether a dedicated native/mobile
  application is wanted at all given the existing responsive web
  experience, and if so **no framework, platform, or technology has
  been selected or evaluated anywhere in this document** — native iOS/
  Android, a cross-platform framework, and a mobile-optimized web
  variant are all still open, undecided options.

### 7. Tax reporting

- **Priority tier**: Lower — not yet scopeable.
- **Rationale / dependencies**: the most jurisdiction-sensitive item on
  this list — tax treatment of a leveraged Bitcoin position varies by
  jurisdiction in ways this project has no authoritative source for
  today.
- **Owner decision required**: **which jurisdiction(s), if any, to
  target — this document does not choose one, and none is implied.**
  An engineering estimate is not meaningful until this decision is
  made; listed here as a named candidate only, per `06_TASKS.md`'s own
  list, not as scoped or estimated work.

### 8. AI insights

- **Priority tier**: Lowest — least concrete, not least valuable.
- **Rationale / dependencies**: no existing architecture, data model,
  or first-draft feature definition exists for this item today. (Not
  to be confused with `05_AI_PROMPTS.md`, which governs *building this
  application* with AI assistance, not an AI-insights *product
  feature* — a distinction worth stating explicitly so the two are
  never conflated.)
- **Owner decision required**: what "AI insights" actually means as a
  product feature — and, whatever it means, **it must not be
  positioned as financial advice**. This application's own existing,
  established framing (`docs/USER_GUIDE.md`'s "What ProfitPilot is
  not": "not financial advice," every suggested action "a calculation
  you should verify yourself") applies to any future AI-insights
  feature exactly as it applies to today's rule-based Recommendations —
  an AI-generated suggestion is not exempt from that framing merely for
  being AI-generated.

## What determined this order

Three consistent factors, applied the same way across all eight items:
**existing architectural readiness** (is there already a foundation to
build on, or would this be greenfield), **effort/risk** (does this
introduce a new external dependency, a new threat surface, or a new
legal/jurisdictional question), and **dependency structure** (does
another item on this list need to exist first). No item was ranked by
guessing at business value this document has no authority to assess —
that judgment belongs to whoever makes the actual Version 2 product
decision.

## What this document does not do

- It does not commit to building any of the eight items.
- It does not estimate calendar dates or version numbers for any item.
- It does not choose a target jurisdiction for tax reporting, or invent
  one.
- It does not change `01_PRD.md`, `02_Formulas.md`, or any other frozen
  specification document — the "belongs to Version 2" framing those
  documents already use is cited, not rewritten.
- It does not affect Version 1.0.0's scope freeze, formula versions, or
  storage schema in any way.
- It does not reopen or reverse the Milestone 8 cancellation of Cloud
  Database/Cloud Sync — that remains a Version 1 product decision;
  Wallet integrations (item 4) is on-chain read access, a distinct
  capability, not a proposal to rebuild a cloud-backed application data
  store.
- It does not select a mobile-application framework, or imply one has
  already been chosen.
