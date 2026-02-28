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
    ├── 003-object-type-crud/     # 拆分为 003a(后端) + 003b(前端)
    ├── 004-link-type-crud/       # 拆分为 004a(后端) + 004b(前端)
    ├── 005-property-management/  # 拆分为 005a(后端) + 005b(前端) + 005c(类型扩展)
    ├── 006-search/
    ├── 007-change-management/    # 范围缩减为 UI 层
    ├── 008-app-shell/            # 新增：App Shell & UI 基础框架
    └── 009-working-state/        # 新增：Working State 服务层
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

| # | Feature | Phase | Priority | Status |
|---|---------|-------|---------|--------|
| 001 | Project Scaffolding | 1 | P0 | 🔲 Draft |
| 002 | Database Schema（扩充） | 2 | P0 | 🔲 Draft |
| 008 | App Shell & UI 基础框架 | 2 | P0 | 🔲 Draft |
| 009 | Working State 服务层 | 3 | P0 | 🔲 Draft |
| 003a | Object Type CRUD — 后端 | 4 | P0 | 🔲 Draft |
| 004a | Link Type CRUD — 后端 | 4 | P0 | 🔲 Draft |
| 005a | Property Management — 后端（基础类型） | 4 | P0 | 🔲 Draft |
| 003b | Object Type CRUD — 前端 | 5 | P0 | 🔲 Draft |
| 004b | Link Type CRUD — 前端 | 5 | P0 | 🔲 Draft |
| 005b | Property Management — 前端 | 5 | P0 | 🔲 Draft |
| 005c | Property Management — 属性类型扩展 | 6 | P0 | 🔲 Draft |
| 006 | Search | 6 | P0 | 🔲 Draft |
| 007 | Change Management UI | 6 | P0 | 🔲 Draft |

> **注意**：003/004/005 的 a/b/c 子特性共享同一个目录，在各自的 spec.md 中通过"特性拆分"章节区分。

### Phase 说明

| Phase | 描述 | 可并行 |
|-------|------|--------|
| 1 | 基础设施 | — |
| 2 | Schema + UI 骨架 | F002 ∥ F008 |
| 3 | Working State 基础设施 | — |
| 4 | 资源 CRUD 后端 | F003a ∥ F004a ∥ F005a |
| 5 | 资源 CRUD 前端 | F003b ∥ F004b ∥ F005b |
| 6 | 高级特性 | F005c ∥ F006 ∥ F007 |

### 依赖关系图

```
F001
 ├──→ F002 ──→ F009 ──┬→ F003a ──→ F003b ──┐
 │                     ├→ F005a ──→ F005b ──┼→ F005c
 │                     └→ F004a ──→ F004b ──┤
 └──→ F008 ──────────────────→ (所有 b 特性) ├→ F006
                                             └→ F007
```
