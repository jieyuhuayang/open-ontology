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

| # | Feature | Phase | Priority | 状态 |
|---|---------|-------|---------|------|
| 001 | Project Scaffolding | 1 | P0 | ✅ 完成 |
| 002 | Database Schema（扩充） | 2 | P0 | ✅ 完成 |
| 003a | Object Type CRUD — 后端 | 2 | P0 | ✅ 完成（含 Working State 服务层） |
| 008 | App Shell & UI 基础框架 | 3 | P0 | 📋 待开发 |
| 003b | Object Type CRUD — 前端 | 4 | P0 | 📋 待开发 |
| — | **🔍 Demo 走查检查点** | — | — | Phase 4 完成后执行 |
| 004a | Link Type CRUD — 后端 | 5 | P0 | 📋 待开发 |
| 004b | Link Type CRUD — 前端 | 5 | P0 | 📋 待开发 |
| 005a | Property Management — 后端（基础类型） | 6 | P0 | 📋 待开发 |
| 005b | Property Management — 前端 | 6 | P0 | 📋 待开发 |
| 005c | Property Management — 属性类型扩展 | 7 | P0 | 📋 待开发 |
| 006 | Search | 7 | P0 | 📋 待开发 |
| 007 | Change Management UI | 7 | P0 | 📋 待开发 |
| 009 | Working State 服务层（补充） | — | P0 | ⚠️ 见说明 |

> 查看各 feature 状态：`just features-status`（扫描各目录 tasks.md 自动汇总）

> **注意**：003/004/005 的 a/b/c 子特性共享同一个目录，在各自的 spec.md 中通过"特性拆分"章节区分。

### 关于 F009 Working State

F009 的核心逻辑（WorkingStateService、变更合并、合并视图、发布/丢弃）已在 F003a 中一并实现（见 003 tasks.md T005–T006）。F009 spec.md 中定义的 AC1–AC20 大部分已覆盖。

后续如果 F004a/F005a 发现需要扩展 Working State 能力（如支持新的 ResourceType），在各自特性中增量完成即可，**不再单独开 F009 的 plan/tasks**。

### Phase 说明（已按实际进度调整）

| Phase | 描述 | 可并行 | 里程碑 |
|-------|------|--------|--------|
| 1 | 基础设施 | — | ✅ |
| 2 | Schema + Object Type 后端 | F002 ∥ F003a | ✅ |
| 3 | App Shell（UI 骨架） | — | 所有前端页面的基础 |
| 4 | Object Type 前端 | — | **端到端闭环 → Demo 走查** |
| 5 | Link Type 全栈 | F004a ∥ F004b | 复用 003 模式快速推进 |
| 6 | Property 全栈 | F005a ∥ F005b | |
| 7 | 高级特性 | F005c ∥ F006 ∥ F007 | |

### 依赖关系图（已更新）

```
F001 ──→ F002 ──→ F003a ✅
                    │
                    ├──→ F004a ──→ F004b ──┐
                    │                       │
                    └──→ F005a ──→ F005b ──┼→ F005c
                                            │
F001 ──→ F008 ──→ F003b ──→ (Demo 走查)    ├→ F006
              │                             │
              └──→ F004b / F005b / F007 ────┘
```

### 调整说明（2026-02-28）

**原计划问题**：原 Phase 设计中 009 是 003a 的前置依赖，但实际开发中 003a 已将 Working State 一并实现。原计划的 Phase 2 包含 F008，但实际上 F002 和 F003a 先完成了。

**调整策略**：
1. **先做 008 App Shell** — 提供布局骨架（侧边栏、路由、主题、i18n），这是所有前端页面的基础
2. **紧接 003b 前端** — 后端 API 已就绪，补上前端 UI 即可实现 Object Type 的端到端闭环
3. **Demo 走查检查点** — Phase 4 完成后暂停，用户访问前端验证完整流程，确认 UI 模式和交互细节
4. **004 改为全栈一起做** — 吸取 003 的经验，Link Type 的后端和前端在同一 Phase 内完成，避免割裂
5. **F009 不再单独开发** — 已内嵌完成，后续按需增量扩展
