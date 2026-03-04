# Features — Spec-Driven Development (SDD) Guide

This directory houses all feature specifications for Open Ontology, organized using a **Spec-Driven Development (SDD)** approach.

## What is SDD?

SDD is a methodology where each feature is defined through two layered artifacts before any code is written:

| Artifact | File | Purpose |
|----------|------|---------|
| 完整规格 | `spec.md` | 合并需求规范与技术设计 — user stories, **structured AC table**, architecture decisions, DB/Pydantic schemas, API contracts, component trees. No implementation steps, no test strategy. |
| 原子任务 | `tasks.md` | Self-contained execution checklist — each task inlines file, logic, test context. **AC traceability**, status tracking |

This structure is especially suited for AI-assisted development, where each conversation session can focus on a single, well-scoped task rather than an entire feature.

---

## Directory Structure

```
features/
├── README.md                    # This file
├── _templates/                  # Reusable templates
│   ├── spec.md
│   ├── tasks.md
│   └── release-contract.md
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

Not every change requires all artifacts. Use the table below to decide:

| Change Scale | Required Artifacts |
|-------------|-------------------|
| **Complex feature** — crosses multiple layers, introduces new domain concepts | `spec.md`（含完整技术设计）+ `tasks.md` |
| **Medium feature** — single CRUD endpoint or isolated UI component | `spec.md`（简要技术说明）+ `tasks.md` |
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
- Inlines necessary implementation context (file, logic, test) so no need to re-read spec.md

**Test-Implementation Pairing**:
- Test tasks (odd numbers) come **before** their implementation tasks (even numbers)
- Every test task must include `覆盖 AC: AC-NN, AC-NN` linking back to `spec.md`
- Infrastructure tasks (migrations, ORM models, config) have no test pair
- A missing AC annotation on a test task means the spec is incomplete — do not start the paired implementation task

---

## Workflow

> **⚠️ 前提条件（强制）**：写 spec.md 前，必须**完整准确理解 PRD**。
> - 必须先读取 PRD 原文（`docs/prd/` 下对应文件）和 `release-contract.md`
> - 对 PRD 中的功能点、用户场景、边界条件、UI 交互逐一理解，不能遗漏
> - 如果 PRD 内容较长（如主 PRD 约 67KB），必须完整读取，不能只读部分
> - AC 表格必须覆盖 PRD 中描述的所有功能点，遗漏会导致后续实现不完整
> - 技术设计部分必须基于对 PRD 业务逻辑的准确理解，不能凭假设设计

0. **（版本开始时执行一次）Create release-contract.md** — 在第一个 feature spec 动笔前，写版本级领域归属表（表1）和不变量表（表2）。此后每个 spec 评审时，必须对照 release-contract.md 检查一致性。
1. **Create spec.md** — 合并需求规范与技术设计的完整规格文档。写 spec 前必须先完整阅读 PRD 和 release-contract.md。包含：
   - 需求部分：用户故事、验收标准（AC 表格，唯一 ID）、边界情况
   - 设计部分：架构决策、数据库 & Domain 模型、API 契约、前端组件设计、错误码表
   - 设计部分只写 Why + What，不写 How，不写测试策略
2. **审查 spec.md** — 写完后调用 `/sdd-review <feature_dir> spec`，同时检查 PRD gap 和架构合规性。检查列表：
   - PRD 功能点 / 用户场景是否都有对应 AC？
   - AC 是否可测试、边界是否清晰？
   - 所有 AC 是否与 release-contract.md 的不变量一致？
   - 是否越界进入了其他 feature 的归属领域（表1）？
   - 架构决策是否符合项目规范？API 契约是否完整？

   用户看报告后决定是否修改，确认后 → mark spec.md row as ✅ 已评审 in tasks.md 状态表（唯一手动暂停点）
3. **Create tasks.md** — 将 spec 拆解为自包含的原子任务；每个任务内联文件、逻辑、测试上下文（实现阶段不需要回读 spec.md）；每个测试任务必须标注 `覆盖 AC: AC-NN`
4. **Execute tasks** — one per session, checking off as complete; run tests and show output before marking done
5. **Mark deviations** — if implementation differs from plan, note in tasks.md §实际偏差记录

---

## 范围变更传播规则

当一个 feature 的范围决策影响另一个 feature 时（例如：F007 决定"不支持属性向导"，而 F003 的 AC 已包含属性向导逻辑），**必须**按以下顺序处理，禁止仅更新当前 spec 而忽略已有 spec：

1. **先更新 release-contract.md 不变量表**（新增或修改 INV-N）
2. **列出 Impacted Specs 清单**（哪些 feature 的哪些 AC 受影响）
3. **逐一回写受影响的 spec.md**，修改矛盾的 AC
4. **重新评审所有受影响的 spec**（走步骤 2 的评审流程）
5. **全部完成后**才能进入实现

> 违反此规则（仅更新当前 spec、跳过回写）会导致 feature 间 AC 矛盾，产生实现断裂。

---

## Relationship to Existing Docs

- `docs/prd/` — source of truth for *what* the product should do (Chinese)
- `docs/architecture/` — source of truth for *how* the system is designed
- `docs/specs/` — domain model specifications (terminology, property types, etc.)
- `features/` — bridges the above into executable development units

When writing `spec.md`, always link back to the relevant PRD section and reference the relevant architecture document.

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
