# Features — Spec-Driven Development (SDD) Guide

This directory houses all feature specifications for Open Ontology, organized using a **Spec-Driven Development (SDD)** approach.

## What is SDD?

SDD is a methodology where each feature is defined through up to three layered artifacts before any code is written:

| Artifact | File | Purpose |
|----------|------|---------|
| 需求规范 | `spec.md` | What to build — user stories, acceptance criteria, boundaries |
| 技术方案 | `plan.md` | How to build it — data structures, API contracts, component design |
| 原子任务 | `tasks.md` | Execution checklist — one file per task, explicit dependencies |

This structure is especially suited for AI-assisted development, where each conversation session can focus on a single, well-scoped task rather than an entire feature.

---

## Directory Structure

```
features/
├── README.md                    # This file
├── _templates/                  # Reusable templates
│   ├── spec.md
│   ├── plan.md
│   └── tasks.md
└── v0.1.0/                      # MVP feature set
    ├── 001-project-scaffolding/
    ├── 002-database-schema/
    ├── 003-object-type-crud/
    ├── 004-link-type-crud/
    ├── 005-property-management/
    ├── 006-search/
    └── 007-change-management/
```

---

## When to Use Each Level

Not every change requires all three artifacts. Use the table below to decide:

| Change Scale | Required Artifacts |
|-------------|-------------------|
| **Complex feature** — crosses multiple layers, introduces new domain concepts | `spec.md` + `plan.md` + `tasks.md` |
| **Medium feature** — single CRUD endpoint or isolated UI component | `spec.md` (with brief technical notes) + `tasks.md` |
| **Small change** — bug fix, style tweak, copy update | `tasks.md` only |

---

## Feature Numbering Convention

Features are numbered sequentially within each version:

```
{NNN}-{kebab-case-name}
```

- `NNN` — zero-padded three-digit number (001, 002, …)
- Name — lowercase, hyphen-separated, descriptive

Examples:
- `001-project-scaffolding`
- `003-object-type-crud`

When a feature is complete, **do not delete or renumber** — the directory becomes a permanent record.

---

## Task Granularity Rule

Each task in `tasks.md` should be completable in a **single AI conversation session** (roughly 30 minutes of focused work). If a task feels too large, split it.

A well-scoped task:
- Targets **one file** (or at most two closely related files)
- Has **explicit dependencies** listed (which prior tasks must complete first)
- References the relevant section of `plan.md` for technical details

---

## Workflow

1. **Create spec.md** — derive from PRD and architecture docs
2. **Review spec.md** — confirm acceptance criteria are testable
3. **Create plan.md** — design data structures, API contracts, component trees
4. **Create tasks.md** — break plan into atomic file-level tasks
5. **Execute tasks** — one per session, checking off as complete
6. **Mark deviations** — if implementation differs from plan, note in tasks.md

---

## Relationship to Existing Docs

- `docs/prd/` — source of truth for *what* the product should do (Chinese)
- `docs/architecture/` — source of truth for *how* the system is designed
- `docs/specs/` — domain model specifications (terminology, property types, etc.)
- `features/` — bridges the above into executable development units

When writing `spec.md`, always link back to the relevant PRD section.
When writing `plan.md`, always reference the relevant architecture document.

---

## Version Index

### v0.1.0 (MVP)

| # | Feature | Priority | Status |
|---|---------|---------|--------|
| 001 | Project Scaffolding | P0 | 🔲 Draft |
| 002 | Database Schema | P0 | 🔲 Draft |
| 003 | Object Type CRUD | P0 | 🔲 Draft |
| 004 | Link Type CRUD | P0 | 🔲 Draft |
| 005 | Property Management | P0 | 🔲 Draft |
| 006 | Search | P0 | 🔲 Draft |
| 007 | Change Management | P0 | 🔲 Draft |
