# Version 1 Planning Archive

`06_TASKS.md` M10-024 ("Archive Version 1 Planning") — Milestone 10
Batch 5. Dependencies: M10-023 (`docs/VERSION_2_BACKLOG.md`).
Description: "Archive completed planning artifacts." Keep: Historical
roadmap, Milestone completion, Release notes. DoD: "Historical planning
remains available for future reference."

**Audit-first finding**: this task is largely already satisfied. This
project has never deleted a historical record — every milestone's own
completion evidence, the original roadmap, and the release notes
already exist and remain exactly where they were written. The genuine,
small gap this task closes is that no single document previously
pointed to all of them together — this index is that pointer, not a
new archive location or a file-moving operation. Nothing was moved,
renamed, or deleted to produce this document.

## Historical roadmap

`docs/06_TASKS.md` itself — the original, frozen 10-page task
breakdown (Milestones 1–10, 06_TASKS.md's own "Version" field declares
`1.0`) this entire project has followed. Frozen and unedited throughout
(`CONTRIBUTING.md`'s "Specification documents" section); it remains the
authoritative historical roadmap this project was built against,
including the tasks explicitly out of scope for Version 1.0.0.
`docs/VERSION_2_BACKLOG.md` (Milestone 10 Batch 5) is the forward-
looking counterpart — what comes next, not what already happened.

## Milestone completion records

- **Milestones 4–7**: a dedicated, permanent snapshot file per
  milestone — `MILESTONE_4_COMPLETION.md`, `MILESTONE_5_COMPLETION.md`,
  `MILESTONE_6_COMPLETION.md`, `MILESTONE_7_COMPLETION.md`.
- **Milestones 1–3 and 8–10**: no dedicated snapshot file was created
  for these (a deliberate, already-recorded choice for Milestone 8 —
  "this file's own new section is the permanent record instead,"
  `PROJECT_STATUS.md`) — their complete record lives in
  `PROJECT_STATUS.md`'s own per-milestone sections instead:
  `## Milestone 2 progress`, `## Milestone 3 progress`,
  `## Milestone 8 progress`, `## Milestone 9 progress`, `## Milestone
  10 progress` (Milestone 1 is covered by this file's own opening
  `## Completed tasks` section). Both forms — a dedicated snapshot file
  and a `PROJECT_STATUS.md` section — are treated as equally
  authoritative historical records; neither is more "archived" than the
  other.
- **`PROJECT_STATUS.md`'s own "Unresolved documentation conflicts"
  section** (39 conflicts recorded to date) is itself a historical
  planning artifact in the same sense — a running record of every
  specification ambiguity found and how it was resolved (or explicitly
  left open), across all ten milestones.

## Release notes

`docs/RELEASE_NOTES.md` (Milestone 10 Batch 1) — the Version 1.0.0
release-facing summary. `docs/CHANGELOG.md` (Milestone 9 Batch 10) —
the engineering audit trail and version-metadata record (application/
engine/formula/storage-schema/database-migration/documentation
versions). Both remain living documents that gain new entries on a
future release; archiving does not mean freezing them, only ensuring
today's Version 1.0.0 content remains available once a future entry is
added.

## PROJECT_STATUS.md itself

`PROJECT_STATUS.md` — the master implementation-tracking record this
entire engagement has maintained since Milestone 1 — remains available
in full, at its current path, unarchived and unfrozen. It is not itself
a completed planning artifact to be filed away; it is a living document
that continues to gain a new section with every future batch, exactly
as it has for all ten milestones to date (`PROJECT_STATUS.md`'s own
opening line: "tracks real build status, deviations, and open
documentation conflicts... not a specification document"). Every
citation in this archive index to a specific `PROJECT_STATUS.md`
section is a pointer into that same, single, continuously-maintained
file — not a separate, frozen copy.

## What "remains available for future reference" means here

No file referenced above was moved, renamed, consolidated, or deleted
to produce this document. "Archiving" Version 1 planning, for a project
with this engagement's own established "never delete historical
evidence" convention, means confirming the record already exists and
is discoverable — not relocating it to a separate archive directory
that would then need its own set of updated cross-references throughout
every other document that already links to these files by their
current path. A future reader (human or AI) starting from this
document can reach the complete historical record of how Version 1.0.0
was actually planned and built.

**No file was moved, renamed, or deleted to produce this document** —
per this task's own audit-first scope, and per this engagement's
standing "preserve frozen historical evidence" discipline.
