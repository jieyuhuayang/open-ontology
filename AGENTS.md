# AGENTS.md

This file provides guidance to coding agents when working in this repository.


## Project Overview

Open Ontology is an open-source project inspired by the Palantir Ontology. It aims to build an ontology platform designed for the agent era, offering a business-centric unified data modeling framework so that users across different business units and functional teams—as well as LLM-based agents—can share a common set of standardized business terms.

The platform will consist of multiple applications/sub-platforms. The first application — **Ontology Manager** (back-office web UI for managing ontology resources) — was completed in v0.1.0 MVP. The current focus is **v0.2.0 (AI-Assisted Ontology Building)**, which adds Agent-driven ontology construction capabilities including a deepagents engine, `oo` CLI unified capability layer, and material analysis with blueprint generation.

Current version: v0.2.0, building on completed v0.1.0 MVP.

## Repository Status

This repository is in the **implementation phase for v0.2.0**. F012 (Agent Foundation) and F013 (CLI & Skills) are completed.

- Specification documents are still the source of truth for intent.
- Backend and frontend source code are present under `apps/`.
- Tests, migrations, and build tooling are active and maintained.
- New features must continue following SDD workflow in `features/`.

## Repository Structure

```
apps/
├── web/src/                          # Frontend (React + TypeScript)
│   ├── api/                          # TanStack Query hooks + generated types
│   ├── components/                   # Reusable UI components
│   ├── pages/                        # Route-level page components
│   ├── stores/                       # Zustand stores (UI state only)
│   ├── utils/                        # Utility functions (naming, validation, etc.)
│   ├── locales/                      # i18n translation files
│   └── generated/                    # openapi-typescript output (DO NOT EDIT)
├── server/                           # Backend (FastAPI + Python)
│   ├── app/routers/                  # HTTP layer — delegate to services
│   ├── app/services/                 # Business logic, transaction boundaries
│   ├── app/domain/                   # Pydantic models, pure logic, no I/O
│   ├── app/storage/                  # SQLAlchemy queries, return domain models
│   ├── app/agent/                    # Agent engine (deepagents + SSE + prompts + skills)
│   ├── cli/                          # `oo` CLI entry point (Typer, 8 command modules)
│   ├── alembic/                      # Database migrations
│   ├── tests/                        # Tests (unit/ + integration/)
│   └── openapi.json                  # Committed artifact — regenerate after route changes
docs/
├── architecture/                     # 00~06 architecture design documents + README
├── operations/                       # Operations documentation
├── prd/                              # Product requirements + UI design screenshots
├── review/                           # Code review records
├── specs/                            # Domain model specs (terminology, property types, metadata)
└── research/                         # Technical research notes
features/                             # SDD feature directory
├── _templates/                       # spec / tasks templates
├── v0.1.0/                           # 001 ~ 011 feature packages (completed)
└── v0.2.0/                           # 012 ~ 019 feature packages + release-contract.md
e2e/                                  # Playwright E2E tests
├── helpers/                          # Shared utilities (antd.ts, api.ts, fixtures.ts)
└── *.spec.ts                         # Test files
ops/mysql-sample/                     # Local MySQL sample clone scripts
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
| 函数 / 接口 | Function / Interface | Custom logic / polymorphic shape descriptor |
| 共享属性 | Shared Property | Reusable property across multiple object types |
| 对象集 / 空间 | Object Set / Space | Object instance collection / top-level project container |
| Agent 会话 | Agent Session | Agent-user interaction session |
| 蓝图 | Blueprint | Agent-generated ontology modeling proposal (contains blueprint items) |
| 蓝图项 | Blueprint Item | Single suggestion within a blueprint (create OT/Property/LinkType) |
| 素材 | Agent Material | User-uploaded file for analysis |

## Version Roadmap

### v0.1.0 (MVP) — Completed
UI framework, Object Type CRUD, Link Type CRUD, Property Management, ontology search, change management/versioning, data connection, object instance sync.

### v0.2.0 (AI-Assisted Ontology Building) — In Progress
- **Completed**: F012 Agent Foundation (deepagents engine + SSE streaming + session management), F013 CLI & Skills (`oo` unified capability layer + 16 Agent Skills)
- **Planned**: F014 Material & Blueprint, F015-016 Workshop, F017 HITL Review & Apply, F018 Agent Sidekick, F019 Ontology Import/Export

### Deferred
Discover page customization, object type groups, shared properties, Action Type CRUD, object type copying

## Tech Stack Quick Reference

> Full rationale: `docs/architecture/04-tech-stack-recommendations.md`

| Layer | Stack | Package Manager |
|-------|-------|-----------------|
| Frontend | React 18+ TS, Ant Design 5.x, TanStack Query v5, Zustand v5, Vite | pnpm |
| Backend | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 async + asyncpg | uv |
| Agent/CLI | deepagents, LangGraph checkpoint, Typer, Rich | uv |
| Database | PostgreSQL 16+, PG Full-Text Search (no Elasticsearch) | — |
| Testing | pytest + pytest-asyncio (backend), Vitest (frontend unit), Playwright (E2E) | — |
| Monorepo | Just (justfile) as task runner | — |

**Type sharing pipeline**: FastAPI → `openapi.json` → `openapi-typescript` → TS types. Never hand-write API types.

## Local Development Setup (native, no Docker)

```bash
# 1. Database migration (idempotent — run before each start to ensure schema is up to date)
cd apps/server && PYTHONPATH=. uv run alembic upgrade head

# 2. Start backend (must be in apps/server, must set PYTHONPATH=.)
cd apps/server && PYTHONPATH=. uv run uvicorn app.main:app --reload --port 8000

# 3. Start frontend (separate terminal)
cd apps/web && pnpm dev
```

- Backend default connection: `postgresql+asyncpg://ontology:ontology@localhost:5432/open_ontology`
- Frontend default: http://localhost:5173 (auto-increments if port is occupied)
- CLI tool: `cd apps/server && uv run oo --help`

## Code Layering Rules

### Backend (strict top-down, no reverse imports)

| Layer | Directory | Responsibility | May Import |
|-------|-----------|---------------|------------|
| Routers | `app/routers/` | HTTP parsing, request validation, delegate to services | services, domain |
| Services | `app/services/` | Business logic, transaction boundaries | domain, storage |
| Domain | `app/domain/` | Pydantic models, pure logic, no I/O | nothing (leaf layer) |
| Storage | `app/storage/` | SQLAlchemy queries, return domain models | domain |
| Agent | `app/agent/` | deepagents engine, SSE adapter, Prompt/Skill definitions | services, domain |
| CLI | `cli/` | Typer CLI commands (`oo`), delegate to services | services, domain |

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
- **Agent/CLI must NOT access storage directly** — must go through the services layer

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

### External MySQL Test Clone Strategy

- Open Ontology primary storage is PostgreSQL; MySQL is only used as an external import source during MVP.
- **NEVER** run import tests directly against production-grade external databases.
- Use the local sample clone workflow: `ops/mysql-sample/refresh.sh`.
- Credentials only in `ops/mysql-sample/.env.mysql-sample.local` — never commit to repo.
- `ops/mysql-sample/runtime/` artifacts are for local debugging only — must stay out of Git.

## Testing Requirements

These rules are **mandatory** when writing or modifying any backend/frontend source code.

**Backend (Test-First)**

- **Development order: write tests (red) first, then implementation (green)** — backend test tasks must precede corresponding implementation tasks in tasks.md
- New service function → must have unit test in `tests/unit/` (mock DB via `mock_db_session`)
- New API route → must have integration test in `tests/integration/` (use `seeded_client`, cover happy path + main error paths)
- Before marking done: run `cd apps/server && uv run pytest <test_file> -v` and show passing output

**Frontend (Test-Alongside)**

- New page → must have render + core interaction tests in `pages/<Resource>/__tests__/` (Testing Library)
- New Zustand store → must cover core state transitions in `stores/__tests__/`
- New reusable component → must have render test in `components/__tests__/` (Testing Library)
- Frontend tests and implementation may be completed in the same task (no test-first separation required)
- Before marking done: run `cd apps/web && pnpm test --run` and confirm no failures

**E2E (after feature completion, mandatory)**

- **After all tasks are done, you MUST invoke `/e2e-test <feature_dir>` to generate and run E2E tests** — even pure backend changes can affect end-to-end flows, do not skip
- E2E tests cover **UI interaction flow ACs** from spec.md (forms, wizards, bulk operations, cross-page navigation)
- Pure API behavior ACs are covered by backend integration tests, but E2E must still verify related pages have no regression from backend changes
- Shared Ant Design interaction helpers live in `e2e/helpers/antd.ts` — do not duplicate in spec files
- Test data IDs use `e2e-<feature>-` prefix for cross-suite isolation
- Before marking done: run `npx playwright test e2e/<test_file>.spec.ts --reporter=list` and confirm passing

**Prohibited**

- Do NOT mark a task as done without running tests and showing output
- Do NOT split tests into separate follow-up tasks — tests belong with their implementation

## Task-Level Review (L1)

After completing each SDD task and before checking it off, run `/task-review <feature_dir> <task_id>` for L1 lightweight review.

**Three-layer review architecture**:

| Layer | Trigger | Executor | Coverage |
|-------|---------|----------|----------|
| **L0** | Every Write/Edit | arch-guard.sh | Reverse imports, domain I/O, Zustand server state, generated file protection |
| **L1** | After each task | Claude (`/task-review`) | Convention compliance + architecture red lines + task metadata consistency |
| **L2** | After all tasks | Codex + Gemini (`/code-review`) | Full 6-dimension deep review |

**L1 Checklist** (6 items):

| # | Check | Severity |
|---|-------|----------|
| 1 | Layer imports (services→routers, domain I/O, storage→services) | HIGH |
| 2 | Naming conventions (file names, class names, API paths, error codes) | MEDIUM |
| 3 | Serialization convention (Pydantic alias_generator + populate_by_name) | HIGH |
| 4 | Database convention (rid primary key, Alembic migration, async session) | HIGH |
| 5 | Frontend convention (i18n `t()`, no server data in Zustand, auto-generated API types) | MEDIUM |
| 6 | Information leakage (no hard-coded secrets/credentials) | HIGH |

**Verdict rules**: PASS → check off | PASS_WITH_NOTES → check off + record notes | NEEDS_FIX → fix and re-review (max 1 round)

## Development Workflow (SDD — Spec-Driven Development)

> **Prerequisite (mandatory)**: Before writing spec.md, you must **fully and accurately understand the PRD**.
> - Must read the PRD source (`docs/prd/` corresponding file) and `release-contract.md` in full
> - Understand all feature points, user scenarios, boundary conditions, UI interactions — no omissions
> - If the PRD is long (~67KB for the main PRD), must read it completely
> - AC table must cover all feature points described in the PRD
> - Technical design must be based on accurate understanding of PRD business logic

**All new features must follow this sequence** (see `features/README.md`):

0. **(Once per release) release-contract.md** — Before the first feature spec, create version-level domain ownership table and invariants table (template: `features/_templates/release-contract.md`)
1. **Spec Discovery (architect questions)** — After reading PRD + release-contract.md + relevant architecture docs, **do NOT write spec.md directly**. First identify uncertainties in the PRD from an architect's perspective and ask targeted questions.
   - Purpose: **align on uncertainties**, not confirm what's already clear
   - Question dimensions (only ask about what PRD leaves unclear):
     - Boundary conditions: extreme values, empty states, long inputs, batch limits
     - Exception paths: concurrency conflicts, partial success, data inconsistency, cascading effects
     - Permissions & security: role boundaries, unauthorized behavior handling
     - Data constraints: field limits, uniqueness, cascading deletes, data volume
     - Rollback & degradation: failure recovery strategies, migration downgrade plans
     - Cross-feature impact: whether it touches domains owned by other features in release-contract.md
   - If PRD is clear enough with no uncertainties, declare "no questions needed" with rationale and skip
   - **Manual pause point**: must use `AskUserQuestion` to ask and wait for user confirmation
2. **spec.md** — Combined requirements specification and technical design document
   - **Requirements**: user stories, acceptance criteria (AC table), edge cases
   - **Design**: architecture decisions, DB & domain models, API contracts, frontend component design, error code table
   - AC must use table format: `| ID | Role | Action | Expected Result |`, AC-ID unique within feature
   - Design section covers contracts and decisions (Why + What), not implementation steps (How)
   - No test strategy in spec.md (governed by Testing Requirements section above)
3. **Review spec** — After writing spec.md, invoke `/sdd-review <feature_dir> spec`; checks PRD gaps and architecture compliance; **manual pause point** for user confirmation
4. **tasks.md** — Decompose spec into self-contained atomic tasks (template: `features/_templates/tasks.md`)
   - **Backend Test-First**: backend tasks arranged as "test → implementation" pairs; infrastructure tasks (migrations, ORM, config) have no test pair
   - **Frontend Test-Alongside**: frontend implementation tasks include tests, or add test tasks at end of same phase
   - Each task inlines necessary implementation context (files, logic, tests) — no need to re-read spec.md during execution
   - Each test task must annotate `Covers AC: AC-NN, AC-NN`, traceable to spec.md AC table
   - Test tasks missing AC annotations are considered incomplete — do not start corresponding implementation
5. **Review tasks** — After writing tasks.md, auto-invoke `/sdd-review <feature_dir> tasks`; checks AC traceability, task decomposition quality, tech debt prevention; auto-proceeds if passing; auto-fixes high/medium issues (max 2 rounds)
6. **Create feature branch** — `git checkout -b feat/<version>/<feature-id>-<short-name>`
   - Branch naming example: `feat/v0.1.0/005-object-type-crud-frontend`
   - Steps 1-5 (documentation) on main; step 7 (code) on feature branch
7. **Execute** — Implement tasks on feature branch:
   - Write code → run tests → `/task-review <feature_dir> <task_id>` → check off after PASS
7.5. **E2E tests** (mandatory) — After all tasks complete:
   - Invoke `/e2e-test <feature_dir>` to auto-generate and run E2E tests
   - Cover UI interaction ACs from spec.md, max 3 fix rounds
   - Even pure backend features must run E2E to verify related pages have no regression
8. **Code review** — After all tasks complete, invoke `/code-review --base main`
   - Runs automatically (Codex + Gemini in parallel), no user confirmation needed
   - PASS / PASS_WITH_WARNINGS → ready to merge
   - NEEDS_FIX → fix HIGH issues and re-review (max 2 rounds)
9. **Merge** — `git checkout main && git merge --no-ff feat/<version>/<branch> && git branch -d feat/<version>/<branch>`

**Core constraint**: Each step only produces that step's artifacts — do not execute subsequent steps prematurely. Two **manual pause points**: step 1 (Spec Discovery user confirmation) and step 3 (spec review user confirmation). Execution phase runs on feature branch; merge to main after review passes.

### SDD Strict Execution Rules

**Each step only produces that step's files — do not jump ahead:**

- When asked to "complete spec.md" → **only write `spec.md`**, do not generate any source code (`.py`, `.ts`, `.tsx` under `apps/`)
- When asked to "complete tasks.md" → **only write `tasks.md`**, do not generate source code
- Only write source code when explicitly asked to "execute tasks" or "start implementation"
- If the feature directory is missing `spec.md` or `tasks.md`, **complete them first before writing code**

**Common violations to avoid:**

1. Starting code immediately after completing spec.md, skipping tasks.md
2. Auto-entering implementation phase after spec review passes without waiting for user instruction
3. Completing spec.md and code implementation in the same session

## When to Read Detailed Docs

Before implementing a feature, **read the relevant doc first**:

| Implementing | Read First |
|-------------|------------|
| Object Type CRUD | `docs/architecture/02-domain-model.md` + `docs/specs/object-type-metadata.md` |
| Link Type CRUD | `docs/architecture/02-domain-model.md` (LinkType section) + `docs/specs/link-type-metadata.md` |
| Property types | `docs/specs/supported-property-types.md` |
| Property formatting | `docs/specs/property-value-formatting.md` |
| Data connectivity | `docs/architecture/05-data-connectivity.md` |
| Change management / versioning | `docs/architecture/06-change-management.md` |
| UI design / interaction flows | PRD + `docs/prd/0.1.0（MVP）/images/` |
| Full tech stack rationale | `docs/architecture/04-tech-stack-recommendations.md` |

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
