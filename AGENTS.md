# AGENTS.md

This file provides guidance to coding agents when working in this repository.


## Project Overview

Open Ontology is an open-source project inspired by the Palantir Ontology. It aims to build an ontology platform designed for the agent era, offering a business-centric unified data modeling framework so that users across different business units and functional teams—as well as LLM-based agents—can share a common set of standardized business terms.

The platform will consist of multiple applications/sub-platforms. The first application being built is the **Ontology Manager** — a back-office web UI for creating, editing, searching, and deleting ontology resources (object types, link types, properties, etc.).

Current version: v0.1.0 (MVP), focused on Ontology Manager.

## Repository Status

This repository is currently in the **specification/design phase**. It contains PRD documents only — no source code, build system, or tests yet.

> **Note**: Update this section when transitioning from spec to implementation.

## Repository Structure

```
apps/
├── web/                              # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── api/                      # TanStack Query hooks + generated types
│   │   ├── components/               # Reusable UI components
│   │   ├── pages/                    # Route-level page components
│   │   ├── stores/                   # Zustand stores (UI state only)
│   │   ├── locales/                  # i18n translation files
│   │   └── generated/                # openapi-typescript output (DO NOT EDIT)
│   └── package.json
├── server/                           # Backend (FastAPI + Python)
│   ├── routers/                      # HTTP layer — parse requests, delegate to services
│   ├── services/                     # Business logic, transaction boundaries
│   ├── domain/                       # Pydantic models, pure logic, no I/O
│   ├── storage/                      # SQLAlchemy queries, return domain models
│   ├── alembic/                      # Database migrations
│   └── openapi.json                  # Committed artifact — regenerate after route changes
docs/
├── architecture/                     # Architecture design documents
│   ├── 00-design-principles.md       # Core design principles
│   ├── 01-system-architecture.md     # System architecture overview
│   ├── 02-domain-model.md            # Domain model design
│   ├── 03-agent-context-architecture.md  # Agent context architecture
│   ├── 04-tech-stack-recommendations.md  # Tech stack recommendations
│   └── README.md
├── prd/                              # Product Requirements Documents
│   ├── 0 概念定义/                   # Foundational domain concepts
│   │   └── 0 概念定义.md             # Data layer, object layer, security model
│   └── 0_1_0（MVP）/                 # MVP (v0.1.0) specifications
│       ├── 本体管理平台（Ontology Manager） PRD.md  # Main PRD (~67KB)
│       └── images/                   # UI design screenshots (~78 images)
├── specs/                            # Domain model specifications
│   ├── terminology.md                # Glossary of key domain terms
│   ├── supported-property-types.md   # Property type specifications (21 types)
│   ├── object-type-metadata.md       # Object type metadata fields
│   ├── link-type-metadata.md         # Link type metadata fields
│   └── property-value-formatting.md  # Value formatting and conditional formatting
└── research/                         # Technical research notes
    └── unstructured-data-in-ontology.md
justfile                              # Monorepo task runner
```

## Domain Terminology

Use the bilingual terms consistently (Chinese with English in parentheses):

| Chinese | English | Description |
|---------|---------|-------------|
| 本体 | Ontology | The complete semantic model of an organization |
| 对象类型 | Object Type | Abstraction of a real-world entity or event |
| 属性 | Property | Characteristic, state, or measure of an object type |
| 链接类型 | Link Type | Semantic relationship between object types |
| 动作类型 | Action Type | Transactional operations with write-back capabilities |
| 函数 | Function | Custom business logic (Python/ML-backed) |
| 接口 | Interface | Polymorphic shape descriptor for object types |
| 共享属性 | Shared Property | Reusable property across multiple object types |
| 对象集 | Object Set | Collection of object instances |
| 空间 | Space | Top-level container for projects sharing one ontology |

## MVP (v0.1.0) Priority

- **P0**: UI framework, Object Type CRUD, Link Type CRUD, ontology search, change management/versioning
- **P1**: Property value formatting, object-supported links, object type copying, ontology import/export (JSON)
- **P2 (deferred)**: Discover page customization, object type groups, shared properties, Action Type CRUD

## Tech Stack Quick Reference

> Full rationale: `docs/architecture/04-tech-stack-recommendations.md`

| Layer | Stack | Package Manager |
|-------|-------|-----------------|
| Frontend | React 18+ TS, Ant Design 5.x, TanStack Query v5, Zustand v5, Vite | pnpm |
| Backend | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 async + asyncpg | uv |
| Database | PostgreSQL 16+, PG Full-Text Search (no Elasticsearch for MVP) | — |
| Testing | pytest + pytest-asyncio (backend), Vitest (frontend unit), Playwright (E2E) | — |
| Monorepo | Just (justfile) as task runner | — |

**Type sharing pipeline**: FastAPI → `openapi.json` → `openapi-typescript` → TS types. Never hand-write API types.

## Code Layering Rules

### Backend (strict top-down, no reverse imports)

| Layer | Directory | Responsibility | May Import |
|-------|-----------|---------------|------------|
| Routers | `routers/` | HTTP parsing, request validation, delegate to services | services, domain |
| Services | `services/` | Business logic, transaction boundaries | domain, storage |
| Domain | `domain/` | Pydantic models, pure logic, no I/O | nothing (leaf layer) |
| Storage | `storage/` | SQLAlchemy queries, return domain models | domain |

### Frontend

| Layer | Directory | Responsibility |
|-------|-----------|---------------|
| Pages | `pages/` | Compose components + call API hooks + read Zustand stores |
| Components | `components/` | Props-driven; may use API hooks for self-contained data components |
| API | `api/` | TanStack Query hooks + auto-generated types |
| Stores | `stores/` | UI-only state (modal open/close, selected rows, etc.) |

## Hard Constraints

These rules are **non-negotiable**. Violating them creates tech debt that compounds.

### Architecture

- **NO business logic in routers** — routers parse HTTP and delegate to services
- **NO reverse imports** — storage must not import services; services must not import routers
- **NO synchronous SQLAlchemy** — always use async sessions with asyncpg
- **NO hand-written API types in frontend** — always generate from openapi.json
- **NO server data in Zustand** — server state belongs in TanStack Query cache

### Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Python files | `snake_case.py` | `object_type_service.py` |
| Python classes | `PascalCase` | `ObjectTypeService` |
| TS utility files | `kebab-case.ts` | `use-object-types.ts` |
| React components | `PascalCase.tsx` | `ObjectTypeTable.tsx` |
| DB tables | `snake_case`, plural | `object_types` |
| API paths | `/api/v1/kebab-case` | `/api/v1/object-types` |
| Error codes | `UPPER_SNAKE`, module-prefixed | `OBJECT_TYPE_API_NAME_CONFLICT` |

### Serialization

- Python internal: `snake_case`. API JSON output: `camelCase`.
- Configure via Pydantic `model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)`. Never manually rename fields.

### i18n

- **NO hard-coded user-visible strings in components** — always use `t('key')`
- Ant Design locale via `ConfigProvider`
- PRD is in Chinese (Simplified); UI must support internationalization

### Database

- Schema changes must go through **Alembic migrations** — never raw DDL
- Primary keys use `rid` (text, format: `ri.<namespace>.<type>.<uuid4>`) — no auto-increment IDs
- Error response format: `{ "error": { "code": "...", "message": "...", "details": {} } }`

## When to Read Detailed Docs

Before implementing a feature, **read the relevant doc first**:

| Implementing | Read First |
|-------------|------------|
| Object Type CRUD | `docs/architecture/02-domain-model.md` + `docs/specs/object-type-metadata.md` |
| Link Type CRUD | `docs/architecture/02-domain-model.md` (LinkType section) + `docs/specs/link-type-metadata.md` |
| Property types | `docs/specs/supported-property-types.md` |
| Property formatting | `docs/specs/property-value-formatting.md` |
| Change management / versioning | `docs/architecture/01-system-architecture.md` (AD-2, AD-3) |
| UI design / interaction flows | PRD + `docs/prd/0_1_0（MVP）/images/` |
| Full tech stack rationale | `docs/architecture/04-tech-stack-recommendations.md` |

## Development Workflow (SDD — Spec-Driven Development)

**所有新特性必须按以下顺序执行**（参见 `features/README.md`）：

1. **spec.md** — 定义用户故事、验收标准、边界
2. **评审** — 确认 AC 可测试、边界清晰
3. **design.md** — 设计数据结构、API 契约、组件树、架构决策
4. **tasks.md** — 将 design 拆解为原子任务（每个任务一次 AI 会话可完成）
5. **执行** — 逐任务实施，完成后在 tasks.md 打勾

> ⚠️ **禁止跳步**：不得在 design.md 和 tasks.md 完成前开始写代码。
> 每个特性目录下必须存在这三个文件，否则视为流程未完成。

### SDD 严格执行规则

**每一步只产出该步骤的文件，不得提前执行后续步骤：**

- 当用户要求"完成 design.md"时，**只写 `design.md` 文件**，不得生成任何源代码（`apps/` 目录下的 `.py`、`.ts`、`.tsx` 等）
- 当用户要求"完成 tasks.md"时，**只写 `tasks.md` 文件**，不得生成源代码
- 只有当用户明确要求"执行任务"或"开始实现"时，才可以编写源代码
- 如果当前特性目录下缺少 `design.md` 或 `tasks.md`，**必须先补齐，再开始写代码**

**常见违规场景（必须避免）：**

1. 完成 design.md 后直接开始写代码，跳过了 tasks.md
2. 在 design 审批通过后自动进入实现阶段，没有等待用户指令
3. 将 design.md 和代码实现混在同一次会话中完成


## Workflow: Auto-format + Auto-commit on File Edit

A `PostToolUse` hook in `.claude/settings.json` automatically processes file edits made by Claude Code:

- Triggers after `Write`, `Edit`, and `NotebookEdit`
- Auto-formats edited files when applicable:
  - JS/TS/JSON/CSS/HTML via Prettier (project-local first, then global fallback)
  - Python via Ruff format (project-local first, then global fallback)
- Stages all changes (`git add -A`) and auto-commits with:
  - `chore: auto-save <filename> (HH:MM:SS)`
- Skips commit when there are no staged changes
- Runs asynchronously to avoid blocking responses

This keeps each incremental change recoverable via `git log` while reducing manual formatting and commit overhead.
