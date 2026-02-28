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
    ├── 001-project-scaffolding/          ✅ 完成
    ├── 002-database-schema/              ✅ 完成
    ├── 003-object-type-crud/             ✅ 后端完成（含 Working State）
    ├── 004-app-shell/                    📋 下一个开发
    ├── 005-object-type-crud-frontend/    📋 待开发（Demo 走查目标）
    ├── 006-link-type-crud/               📋 全栈
    ├── 007-property-management/          📋 全栈
    ├── 008-search/                       📋
    ├── 009-change-management/            📋
    └── 009-working-state/                📦 已归档（merged into F003）
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

Feature directories serve as permanent records. Renumbering is acceptable during pre-implementation phases to align numbering with execution order.

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

| # | Feature | Phase | Priority | 状态 |
|---|---------|-------|---------|------|
| 001 | Project Scaffolding | 1 | P0 | ✅ 完成 |
| 002 | Database Schema | 2 | P0 | ✅ 完成 |
| 003 | Object Type CRUD — 后端 | 2 | P0 | ✅ 完成（含 Working State 服务层） |
| 004 | App Shell & UI 基础框架 | 3 | P0 | 📋 下一个开发 |
| 005 | Object Type CRUD — 前端 | 4 | P0 | 📋 待开发 |
| — | **🔍 Demo 走查检查点** | — | — | Phase 4 完成后执行 |
| 006 | Link Type CRUD（全栈） | 5 | P0 | 📋 待开发 |
| 007 | Property Management（全栈） | 6 | P0 | 📋 待开发 |
| 008 | Search | 7 | P0 | 📋 待开发 |
| 009 | Change Management UI | 7 | P0 | 📋 待开发 |

> 查看各 feature 状态：`just features-status`（扫描各目录 tasks.md 自动汇总）

> **关于 Working State**：原 009-working-state 的核心逻辑已在 F003 中一并实现（见 003 tasks.md T005–T006），已归档。后续如需扩展 Working State 能力（如支持新的 ResourceType），在各资源 CRUD 特性中增量完成。

### Phase 说明

| Phase | 描述 | 特性 | 里程碑 |
|-------|------|------|--------|
| 1 | 基础设施 | F001 | ✅ |
| 2 | Schema + Object Type 后端 | F002, F003 | ✅ |
| 3 | App Shell（UI 骨架） | F004 | 所有前端页面的基础 |
| 4 | Object Type 前端 | F005 | **端到端闭环 → Demo 走查** |
| 5 | Link Type 全栈 | F006 | 复用 F003 模式快速推进 |
| 6 | Property 全栈 | F007 | |
| 7 | 高级特性 | F008, F009 | F008 ∥ F009 可并行 |

### 依赖关系图

```
F001 ✅ ──→ F002 ✅ ──→ F003 ✅ (后端+WorkingState)
                          │
F001 ✅ ──→ F004 ──→ F005 ──→ 🔍 Demo 走查
                │
                ├──→ F006 (link-type 全栈)
                ├──→ F007 (property 全栈)
                ├──→ F008 (search) ←── F006, F007
                └──→ F009 (change-management UI)
```

### 重编号说明（2026-02-28）

目录编号已重新排列，使编号 = 执行顺序：

| 旧编号 | 新编号 | 说明 |
|--------|--------|------|
| 001–003 | 001–003 | 不变 |
| 008 app-shell | **004** | 提前，下一个开发 |
| *新增* | **005** object-type-crud-frontend | 从 F003b 拆出为独立特性 |
| 004 link-type-crud | **006** | 重编号 |
| 005 property-management | **007** | 重编号 |
| 006 search | **008** | 重编号 |
| 007 change-management | **009** | 重编号 |
| 009 working-state | **归档** | 已合并到 F003 |
