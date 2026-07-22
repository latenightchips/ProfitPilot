# 05_AI_PROMPTS

Project

ProfitPilot

Page

1 of 5

Title

AI Development Philosophy & Prompting Standards

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

---

# PURPOSE

This document defines how AI should be used throughout the development of ProfitPilot.

Its goal is to maximize development quality, consistency, and productivity while minimizing incorrect assumptions and unnecessary code generation.

AI is a development partner.

It is not the architect.

Project architecture, formulas, requirements, and engineering standards are defined by the documentation.

AI is responsible for implementing those decisions.

---

# AI PHILOSOPHY

AI should

Accelerate development.

Reduce repetitive work.

Improve code quality.

Generate documentation.

Suggest improvements.

Find bugs.

Write tests.

Review implementations.

AI should never replace critical engineering decisions without explicit approval.

---

# SOURCE OF TRUTH

Every AI coding session must treat the documentation as authoritative.

Priority

README.md

↓

01_PRD.md

↓

02_FORMULAS.md

↓

03_UI.md

↓

04_BUILD_GUIDE.md

↓

Current Task

If generated code conflicts with documentation

Documentation always wins.

---

# AI WORKFLOW

Every implementation follows the same process.

Read Documentation

↓

Understand Requirements

↓

Create Plan

↓

Implement

↓

Write Tests

↓

Self Review

↓

Present Result

Skipping planning usually produces lower quality code.

---

# GENERAL PROMPT STRUCTURE

Every implementation request should contain

Objective

Relevant documentation

Constraints

Expected output

Definition of Done

Example

Objective

Implement the Portfolio Summary section.

Documentation

03_UI.md

Page 3

Constraints

Use existing components.

Do not implement financial calculations.

Use TypeScript.

Expected Output

Working React components.

Definition of Done

Tests pass.

No TypeScript errors.

No duplicated logic.

---

# UNIVERSAL AI RULES

Before writing code

Read the relevant documentation.

Never guess business logic.

Never invent formulas.

Never duplicate calculations.

Prefer existing code over new code.

Keep implementations small and modular.

Explain important design decisions.

Run tests before declaring completion.

---

# WHEN AI SHOULD ASK QUESTIONS

AI should ask for clarification when

Requirements conflict.

Documentation is incomplete.

Multiple implementations are equally valid.

Requested behavior changes documented formulas.

A security decision is required.

AI should not ask questions that can already be answered by the documentation.

---

# WHEN AI SHOULD NOT ASK QUESTIONS

AI should proceed when

Requirements are clearly documented.

Existing patterns already exist.

Implementation is straightforward.

Minor implementation details are obvious.

Avoid unnecessary interruptions.

---

# AI OUTPUT FORMAT

Unless otherwise requested, implementation responses should include

1.

Summary

2.

Implementation Plan

3.

Files Created or Modified

4.

Important Decisions

5.

Testing Performed

6.

Remaining Work

This format makes development sessions easier to review.

---

# CODE GENERATION PRINCIPLES

Generated code should

Be readable.

Be typed.

Be documented where appropriate.

Reuse existing modules.

Follow repository structure.

Match coding standards.

Avoid unnecessary abstraction.

Optimize for maintainability rather than cleverness.

---

# AI LIMITATIONS

AI should explicitly acknowledge when

Documentation is missing.

Requirements are ambiguous.

External API behavior is unknown.

A recommendation is based on assumptions.

Transparency is preferred over false certainty.

---

# PROJECT CONTEXT

Before beginning a new coding session, AI should assume

ProfitPilot is a personal financial planning application.

The Formula Engine is the single source of financial calculations.

The UI never performs calculations.

Manual Mode must always work.

User privacy has high priority.

Version 1 favors simplicity over feature count.

---

# ACCEPTANCE CRITERIA

✓ AI philosophy defined.

✓ Documentation hierarchy established.

✓ Standard AI workflow documented.

✓ Prompt structure standardized.

✓ Universal AI rules established.

✓ AI responsibilities clearly defined.

---

END OF PAGE 1

NEXT

Page 2

Feature Implementation Prompt Templates

# 05_AI_PROMPTS

Project

ProfitPilot

Page

2 of 5

Title

Feature Development Prompt Templates

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

---

# PURPOSE

This chapter provides reusable prompts for implementing new features in ProfitPilot.

Rather than writing a new prompt for every development session, developers should begin from these templates and adapt them to the current task.

Each prompt is designed to produce consistent, high-quality implementations.

---

# GENERAL RULES

Every prompt assumes

The repository already exists.

Documentation is complete.

The AI coding agent has access to the repository.

All engineering standards defined in 04_BUILD_GUIDE.md must be followed.

---

# TEMPLATE

NEW FEATURE

Objective

Implement a new feature.

Prompt

You are implementing a new feature for ProfitPilot.

Before writing code, review the relevant documentation.

Required reading

README.md

01_PRD.md

02_FORMULAS.md (if calculations are involved)

03_UI.md

04_BUILD_GUIDE.md

Requirements

• Follow existing architecture.

• Reuse existing components.

• Do not duplicate business logic.

• Use TypeScript.

• Follow repository coding standards.

• Add tests where appropriate.

Expected Output

Summary

Implementation Plan

Files Created

Files Modified

Tests Added

Important Decisions

Remaining Work

---

# TEMPLATE

NEW PAGE

Objective

Create a new application page.

Prompt

Create a new page using the existing application layout.

Requirements

Reuse the application shell.

Keep routing simple.

Use existing shared components whenever possible.

Move business logic into Services.

Do not perform financial calculations inside React components.

Include

Loading state

Empty state

Error state

Responsive layout

Accessibility support

Definition of Done

The page matches the UI specification.

---

# TEMPLATE

NEW COMPONENT

Objective

Create a reusable UI component.

Prompt

Build a reusable React component.

Requirements

Small responsibility.

Typed props.

Reusable.

Accessible.

No API calls.

No Formula Engine access.

Include

Example usage

Component documentation

Unit tests

The component should be usable throughout the application.

---

# TEMPLATE

NEW SERVICE

Objective

Implement a Service.

Prompt

Create a Service that coordinates application logic.

Requirements

Use typed objects.

Call the Engine when calculations are required.

Do not access React components.

Do not format UI values.

Return clean domain models.

Include

Tests

Documentation

Error handling

---

# TEMPLATE

NEW FORM

Objective

Implement a form.

Prompt

Build a React Hook Form using Zod validation.

Requirements

Typed schema.

Live validation.

Helpful error messages.

Accessible labels.

Numeric formatting where appropriate.

Use Services for calculations.

Do not perform calculations inside the form.

Include

Reset

Loading

Validation

Responsive behavior

---

# TEMPLATE

NEW DASHBOARD SECTION

Objective

Create a Dashboard section.

Prompt

Implement a Dashboard section using existing KPI cards and shared components.

Requirements

Read data from Services.

Never calculate metrics inside the UI.

Display loading, empty and error states.

Support responsive layouts.

Keep the implementation modular.

---

# TEMPLATE

NEW SETTINGS PAGE

Objective

Create a settings section.

Prompt

Implement a Settings page.

Requirements

Separate display preferences from portfolio preferences.

Persist settings using the configured storage layer.

Support automatic saving where appropriate.

Do not mix application settings with financial calculations.

---

# TEMPLATE

NEW IMPORT / EXPORT FEATURE

Objective

Implement Import or Export functionality.

Prompt

Create Import or Export functionality.

Requirements

Validate every file.

Support documented formats only.

Use Services.

Never modify portfolio data before validation succeeds.

Provide helpful error messages.

---

# TEMPLATE

NEW API PROVIDER

Objective

Add an external provider.

Prompt

Implement a new provider following the Provider interface.

Requirements

Validate responses.

Support timeouts.

Implement retry logic.

Support fallback behavior.

Never expose provider-specific logic outside Infrastructure.

---

# TEMPLATE

NEW PROTOCOL

Objective

Support an additional lending protocol.

Prompt

Implement a new protocol adapter.

Requirements

Reuse the existing Provider interface.

Do not modify the Engine.

Protocol-specific logic belongs inside Infrastructure.

The rest of the application should continue working without modification.

---

# TEMPLATE

NEW PORTFOLIO FEATURE

Objective

Implement functionality related to portfolio management.

Prompt

Build the requested portfolio feature.

Requirements

Support multiple portfolios.

Preserve existing portfolio structure.

Do not modify calculations.

Keep portfolio persistence independent of the UI.

---

# TEMPLATE

NEW SIMULATION FEATURE

Objective

Implement a new simulation.

Prompt

Create a new simulation feature.

Requirements

Use the Simulation Service.

Reuse Formula Engine calculations.

Display assumptions.

Support comparison with existing simulations.

Never hardcode protocol values.

---

# TEMPLATE

NEW EXIT STRATEGY FEATURE

Objective

Implement a new Exit Planner feature.

Prompt

Build the requested Exit Planner functionality.

Requirements

Use existing Exit Services.

Display assumptions.

Explain recommendations.

Preserve transparency.

Avoid introducing hidden optimization logic.

---

# TEMPLATE

FEATURE COMPLETION CHECKLIST

Before marking the feature complete, verify

✓ Documentation reviewed.

✓ Existing code reused where possible.

✓ No duplicated logic.

✓ TypeScript passes.

✓ Tests added.

✓ Accessibility considered.

✓ Responsive layout verified.

✓ Build succeeds.

---

# ACCEPTANCE CRITERIA

✓ Feature templates created.

✓ Standard implementation prompts documented.

✓ Architecture requirements reinforced.

✓ Reusable prompt library established.

---

END OF PAGE 2

NEXT

Page 3

Formula, Testing, Bug Fixing & Refactoring Prompt Templates

# 05_AI_PROMPTS

Project

ProfitPilot

Page

3 of 5

Title

Formula, Testing, Bug Fixing & Refactoring Prompt Templates

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

Pages 1–2

---

# PURPOSE

This chapter provides reusable prompts for implementing financial formulas, writing tests, fixing bugs, reviewing code, and refactoring existing functionality.

These prompts are intended to preserve correctness while improving implementation quality.

---

# GENERAL RULES

Before modifying existing code

Understand the current implementation.

Read the relevant documentation.

Review existing tests.

Preserve documented behavior.

Never change financial calculations without updating the corresponding Formula ID documentation.

---

# TEMPLATE

IMPLEMENT A FORMULA

Objective

Implement a documented Formula ID.

Prompt

Implement the requested Formula ID exactly as documented in **02_FORMULAS.md**.

Requirements

• Do not change the mathematical definition.

• Keep the implementation deterministic.

• Validate all inputs.

• Return typed results.

• Do not access React, APIs or persistence.

Include

Unit tests

Boundary tests

Error handling

Documentation comments referencing the Formula ID

Expected Output

Summary

Files Created

Files Modified

Tests Added

Verification Notes

---

# TEMPLATE

UPDATE A FORMULA

Objective

Modify an existing Formula ID.

Prompt

Update the implementation of the specified Formula ID.

Requirements

Explain why the formula changed.

Preserve compatibility where possible.

Update affected tests.

Identify every dependent Service.

List every UI element affected.

Never change formulas silently.

---

# TEMPLATE

WRITE UNIT TESTS

Objective

Create unit tests.

Prompt

Write comprehensive unit tests for the requested module.

Requirements

Test

Normal inputs

Boundary values

Invalid inputs

Edge cases

Regression scenarios

Keep tests deterministic.

Avoid external APIs.

---

# TEMPLATE

WRITE INTEGRATION TESTS

Objective

Verify multiple modules working together.

Prompt

Create integration tests for the requested workflow.

Requirements

Exercise Services and Engine together.

Mock Infrastructure dependencies.

Verify expected outputs.

Keep tests readable and independent.

---

# TEMPLATE

WRITE END-TO-END TESTS

Objective

Verify complete user workflows.

Prompt

Create Playwright tests covering the requested user flow.

Include

Navigation

User input

Expected calculations

Validation messages

Successful completion

Keep tests stable and repeatable.

---

# TEMPLATE

FIX A BUG

Objective

Resolve a reported defect.

Prompt

Investigate and fix the reported bug.

Workflow

Reproduce the issue.

↓

Identify the root cause.

↓

Write a failing test.

↓

Implement the fix.

↓

Verify all tests pass.

↓

Explain the cause.

Requirements

Do not introduce unrelated changes.

Keep the fix as small as possible.

Add a regression test.

---

# TEMPLATE

REFACTOR CODE

Objective

Improve existing code without changing behavior.

Prompt

Refactor the requested module.

Goals

Improve readability.

Reduce duplication.

Simplify architecture.

Improve naming.

Reduce complexity.

Do not

Modify business logic.

Change Formula outputs.

Alter public behavior.

After refactoring

Run all affected tests.

Explain the improvements.

---

# TEMPLATE

PERFORM A CODE REVIEW

Objective

Review existing code.

Prompt

Review the implementation as a senior software engineer.

Evaluate

Architecture

Readability

Maintainability

Correctness

Performance

Security

Accessibility

Testing

Documentation

Output

Strengths

Weaknesses

Risks

Recommendations

Priority improvements

Do not rewrite code unless requested.

---

# TEMPLATE

PERFORMANCE REVIEW

Objective

Identify performance improvements.

Prompt

Review the requested implementation for performance.

Evaluate

Unnecessary renders

Expensive calculations

Repeated API calls

Memory usage

Bundle size

State updates

Caching opportunities

Recommend improvements that preserve existing behavior.

---

# TEMPLATE

SECURITY REVIEW

Objective

Review implementation security.

Prompt

Review the requested code for security concerns.

Evaluate

Input validation

Authentication

Authorization

Secrets

Environment variables

Error handling

Data exposure

Dependency risks

Recommend practical improvements.

---

# TEMPLATE

ACCESSIBILITY REVIEW

Objective

Review accessibility.

Prompt

Evaluate the requested UI implementation against WCAG 2.2 AA guidance.

Review

Keyboard navigation

Labels

ARIA usage

Focus management

Color contrast

Screen reader support

Responsive behavior

Provide actionable recommendations.

---

# TEMPLATE

DOCUMENTATION UPDATE

Objective

Update project documentation.

Prompt

Update documentation to reflect the implementation.

Requirements

Keep documentation synchronized with code.

Remove outdated information.

Avoid duplication.

Preserve document structure and formatting.

---

# TEMPLATE

REGRESSION ANALYSIS

Objective

Determine whether a change could affect existing functionality.

Prompt

Analyze the requested change.

Identify

Affected modules

Dependent Services

Affected UI

Potential regressions

Required tests

Migration concerns

Provide a risk assessment before implementation.

---

# UNIVERSAL REVIEW CHECKLIST

Before completing any task verify

✓ Documentation followed.

✓ Existing patterns reused.

✓ No duplicated logic.

✓ TypeScript passes.

✓ Tests pass.

✓ No undocumented Formula changes.

✓ No unnecessary dependencies.

✓ Public behavior preserved.

✓ Code remains understandable.

---

# ACCEPTANCE CRITERIA

✓ Formula implementation prompts documented.

✓ Testing prompts documented.

✓ Bug fixing workflow standardized.

✓ Refactoring prompts documented.

✓ Code review templates created.

✓ Security and accessibility review prompts included.

---

END OF PAGE 3

NEXT

Page 4

Planning, Architecture, Documentation & Research Prompt Templates

# 05_AI_PROMPTS

Project

ProfitPilot

Page

4 of 5

Title

Planning, Architecture, Documentation & Research Prompt Templates

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

Pages 1–3

---

# PURPOSE

This chapter provides reusable prompts for planning features, evaluating architecture, researching technologies, and maintaining documentation.

These prompts are intended to improve design quality before implementation begins.

Good planning reduces bugs, unnecessary complexity, and future refactoring.

---

# GENERAL PRINCIPLES

Planning should always precede implementation.

The AI coding agent should understand the problem before proposing a solution.

When multiple valid solutions exist, compare them before selecting one.

Recommendations should always be justified using the project documentation and engineering principles.

---

# TEMPLATE

IMPLEMENTATION PLAN

Objective

Create an implementation plan before coding.

Prompt

Analyze the requested feature and produce a step-by-step implementation plan.

Include

Overview

Affected modules

New files

Modified files

Dependencies

Potential risks

Testing strategy

Estimated implementation order

Do not generate code.

Focus on planning only.

---

# TEMPLATE

ARCHITECTURE REVIEW

Objective

Evaluate a proposed architectural decision.

Prompt

Review the proposed architecture.

Evaluate

Consistency with the Build Guide

Scalability

Maintainability

Complexity

Coupling

Separation of concerns

Future extensibility

Output

Strengths

Weaknesses

Trade-offs

Recommendation

---

# TEMPLATE

DESIGN A NEW FEATURE

Objective

Design a feature before implementation.

Prompt

Design the requested feature using existing project architecture.

Include

User flow

Required Services

Engine changes (if any)

State management

UI components

Persistence

Testing approach

Documentation updates

Avoid implementation details.

Focus on overall design.

---

# TEMPLATE

TECHNOLOGY EVALUATION

Objective

Evaluate a new library or technology.

Prompt

Assess whether the proposed technology should be added to ProfitPilot.

Compare

Benefits

Drawbacks

Maintenance impact

Bundle size

Learning curve

Alternatives

Compatibility with the existing architecture

Conclude with

Recommended

Not Recommended

Further Investigation Required

---

# TEMPLATE

DEPENDENCY REVIEW

Objective

Evaluate a third-party dependency.

Prompt

Review the requested dependency.

Consider

Project maturity

Maintenance activity

Documentation quality

Community adoption

Security history

Licensing

Long-term viability

Prefer existing project capabilities whenever possible.

---

# TEMPLATE

DATA MODEL REVIEW

Objective

Review or extend the data model.

Prompt

Evaluate the proposed data model.

Review

Normalization

Relationships

Scalability

Future migrations

Validation requirements

Backward compatibility

Recommend improvements while preserving existing data.

---

# TEMPLATE

DOCUMENTATION REVIEW

Objective

Review project documentation.

Prompt

Review the specified documentation.

Check

Accuracy

Consistency

Missing information

Outdated sections

Duplicated content

Formatting consistency

Suggest improvements without changing project requirements.

---

# TEMPLATE

CREATE DOCUMENTATION

Objective

Generate new project documentation.

Prompt

Create documentation following the existing documentation style.

Requirements

Clear structure

Consistent terminology

Professional tone

Markdown formatting

Examples where appropriate

Avoid unnecessary repetition.

Documentation should describe intent rather than duplicate code.

---

# TEMPLATE

RESEARCH A TOPIC

Objective

Research a technical topic relevant to the project.

Prompt

Research the requested topic.

Provide

Overview

Advantages

Disadvantages

Implementation considerations

Potential risks

Recommendation for ProfitPilot

Distinguish established facts from assumptions or opinions.

---

# TEMPLATE

DECISION ANALYSIS

Objective

Compare multiple implementation options.

Prompt

Compare the proposed solutions.

For each option evaluate

Complexity

Maintainability

Performance

Scalability

Developer experience

Compatibility with existing architecture

Conclude with the recommended approach and explain why.

---

# TEMPLATE

MIGRATION PLAN

Objective

Plan a significant change.

Prompt

Create a migration plan.

Include

Current state

Target state

Required steps

Backward compatibility

Testing strategy

Rollback plan

Risks

Do not perform the migration.

Create the plan only.

---

# TEMPLATE

PROJECT HEALTH REVIEW

Objective

Evaluate the overall quality of the project.

Prompt

Review the current project.

Evaluate

Architecture

Documentation

Code quality

Testing

Performance

Security

Maintainability

Developer experience

Provide

Strengths

Weaknesses

High-priority improvements

Long-term recommendations

---

# PLANNING CHECKLIST

Before implementation verify

✓ Requirements understood.

✓ Documentation reviewed.

✓ Existing architecture reused.

✓ Risks identified.

✓ Dependencies evaluated.

✓ Testing planned.

✓ Documentation impact considered.

---

# ACCEPTANCE CRITERIA

✓ Planning templates documented.

✓ Architecture review prompts created.

✓ Research prompts documented.

✓ Documentation prompts standardized.

✓ Technology evaluation templates created.

✓ Migration planning template included.

✓ Project review templates completed.

---

END OF PAGE 4

NEXT

Page 5

Project Management, Task Generation & AI Session Workflow

# 05_AI_PROMPTS

Project

ProfitPilot

Page

5 of 5

Title

AI Session Workflow, Task Management & Continuous Development

Version

1.0

Dependencies

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

Pages 1–4

---

# PURPOSE

This chapter defines how AI should be used throughout the complete development lifecycle of ProfitPilot.

It combines the prompt templates from previous chapters into a repeatable workflow that supports planning, implementation, review, and continuous improvement.

The objective is consistent, maintainable, high-quality development.

---

# AI DEVELOPMENT LIFECYCLE

Every development session should follow the same workflow.

Understand

↓

Plan

↓

Implement

↓

Test

↓

Review

↓

Document

↓

Commit

↓

Next Task

Each session should end with a working application.

---

# STARTING A NEW SESSION

Begin every session by providing

Current objective

Relevant documentation

Current progress

Constraints

Desired outcome

Example

Objective

Implement the Simulation Workspace.

Documentation

03_UI.md

Pages 6–9

Constraints

Reuse existing services.

No Formula changes.

Expected Result

Working feature with tests.

---

# CONTINUING AN EXISTING SESSION

Prompt

Continue the previous implementation.

Before writing code

Summarize completed work.

Identify remaining tasks.

Verify consistency with project documentation.

Continue from the current state without repeating completed work.

---

# BREAKING DOWN LARGE FEATURES

Prompt

Break the requested feature into small implementation tasks.

Requirements

Each task should

Have a single objective.

Be independently testable.

Be completable in one development session.

Include

Description

Dependencies

Estimated complexity

Definition of Done

---

# DAILY DEVELOPMENT PROMPT

Prompt

Review the current project status.

Recommend the next highest-priority implementation task.

Explain why it should be completed next.

List

Prerequisites

Affected files

Expected outcome

Testing requirements

Documentation updates

---

# END OF SESSION REVIEW

Prompt

Review today's implementation.

Summarize

Completed work

Modified files

Tests added

Outstanding issues

Recommended next steps

Potential technical debt

Produce a concise development log suitable for a commit or project journal.

---

# PROJECT PROGRESS REVIEW

Prompt

Evaluate overall project progress.

Compare the current implementation against

README.md

01_PRD.md

02_FORMULAS.md

03_UI.md

04_BUILD_GUIDE.md

Identify

Completed features

Missing features

Documentation gaps

Testing gaps

High-priority work remaining

---

# RELEASE READINESS REVIEW

Prompt

Determine whether the project is ready for release.

Review

Required features

Testing coverage

Documentation

Performance

Security

Accessibility

Build status

Output

Ready

Not Ready

Action Items

---

# TECHNICAL DEBT REVIEW

Prompt

Review the project for technical debt.

Identify

Duplicated logic

Large files

Unused code

Architecture violations

Naming inconsistencies

Missing tests

Incomplete documentation

Recommend improvements in priority order.

---

# AI SELF-REVIEW

Before completing any implementation, the AI coding agent should verify

Did I understand the requirements?

Did I follow the documentation?

Did I reuse existing code?

Did I avoid duplicating logic?

Did I preserve documented behavior?

Did I write appropriate tests?

Did I document important decisions?

Did I keep the implementation simple?

If any answer is "No", continue improving the implementation before declaring the task complete.

---

# RECOMMENDED AI WORKFLOW

Planning

↓

Architecture Review

↓

Implementation

↓

Testing

↓

Code Review

↓

Documentation Update

↓

Session Review

↓

Commit

↓

Next Task

Following the same workflow throughout the project produces more consistent results.

---

# PROMPT SELECTION GUIDE

| Goal | Recommended Prompt |
|------|--------------------|
| Build a new feature | New Feature |
| Create a page | New Page |
| Build a reusable component | New Component |
| Add business logic | New Service |
| Implement calculations | Implement a Formula |
| Fix a bug | Fix a Bug |
| Improve existing code | Refactor Code |
| Evaluate quality | Code Review |
| Improve performance | Performance Review |
| Improve security | Security Review |
| Improve accessibility | Accessibility Review |
| Design a feature | Design a New Feature |
| Evaluate architecture | Architecture Review |
| Compare solutions | Decision Analysis |
| Plan major changes | Migration Plan |
| Track progress | Project Progress Review |
| Prepare a release | Release Readiness Review |

This table serves as a quick reference when choosing the appropriate prompt.

---

# GUIDING PRINCIPLES

AI should always

Understand before implementing.

Prefer simplicity over cleverness.

Preserve documented behavior.

Write maintainable code.

Explain important decisions.

Keep documentation synchronized.

Prioritize correctness over speed.

Respect user privacy.

---

# DOCUMENT MAINTENANCE

This prompt library should evolve with the project.

When new development patterns become common

Add a reusable prompt.

When prompts become obsolete

Update or remove them.

Avoid duplicate prompts.

Maintain one clear template for each recurring development activity.

---

# FINAL AI PRINCIPLES

The AI coding agent is responsible for implementing the documented vision of ProfitPilot.

It should

Follow the documentation.

Respect the established architecture.

Produce readable, maintainable code.

Explain important decisions.

Surface uncertainty instead of guessing.

Leave the project in a better state after every session.

---

# DOCUMENT COMPLETION

This document provides

AI development philosophy.

Feature implementation templates.

Formula and testing prompts.

Planning and architecture prompts.

Project management prompts.

AI workflow guidance.

Together with the Product Requirements Document, Formula Specification, UI Specification, and Build Guide, it enables consistent AI-assisted development throughout the lifecycle of ProfitPilot.

---

# ACCEPTANCE CRITERIA

✓ AI development philosophy documented.

✓ Feature implementation prompts created.

✓ Formula and testing prompts documented.

✓ Planning and architecture prompts documented.

✓ Project workflow established.

✓ Task management prompts created.

✓ AI session workflow defined.

✓ Prompt selection guide included.

✓ Long-term maintenance guidance documented.

---

END OF DOCUMENT

05_AI_PROMPTS.md

Version 1.0 Complete
