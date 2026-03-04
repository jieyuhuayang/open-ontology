# Open Ontology - Project Context & Mandates

Open Ontology is an open-source ontology platform inspired by Palantir, designed for the AI agent era. It provides a business-centric unified data modeling framework for standardized semantic sharing.

## Core Mission & Architecture

- **Ontology Layers**: Object Types, Properties, Link Types, Action Types.
- **5-Layer System**: Consumption (Web/MCP), Service, Domain, Storage (PostgreSQL), Data Source.
- **Key Paradigms**:
    - **Schema-Data Separation**: Metadata (Schema) is managed independently of source data.
    - **Working State Pattern**: Changes must be staged and reviewed before saving/publishing.
    - **RID System**: All resources use a unique Resource ID: `ri.<namespace>.<type>.<uuid4>`.

## Development Workflow (SDD)

All new features **must** follow the Sequential Development Design (SDD) workflow:
1.  **spec.md**: Define User Stories and Acceptance Criteria (AC).
2.  **spec review**: Move to design only after user approval.
3.  **design.md**: Architectural decisions and API/Data contracts (No implementation details).
4.  **tasks.md**: Atomic test-implementation pairs, each linked to an AC ID from the spec.
5.  **Execution**: Implement tasks one by one. **Do not write code before tasks are approved.**

## Coding Standards & Redlines

### Backend (Python/FastAPI)
- **Strict Layering**: `Routers` -> `Services` -> `Domain` & `Storage`.
    - **Routers**: HTTP parsing only; delegate to services.
    - **Services**: Business logic and transaction boundaries.
    - **Domain**: Pydantic models, pure logic, no I/O.
    - **Storage**: SQLAlchemy queries, return domain models.
- **No Reverse Imports**: Storage cannot import Services; Services cannot import Routers.
- **Async Only**: Use `async session` + `asyncpg`. No synchronous SQLAlchemy calls.

### Frontend (React/TS)
- **API Types**: **Never** hand-write API types. Generate them from `openapi.json` using `web-typegen`.
- **State Management**: Use TanStack Query for server state. Use Zustand **only** for transient UI state.
- **i18n**: No hardcoded user-facing strings. Use `t('key')`.

## Tech Stack Summary

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 (Async), Alembic, Pydantic v2, `uv`.
- **Frontend**: React 18, Ant Design 5, TanStack Query v5, Zustand v5, Vite, `pnpm`.
- **Infrastructure**: PostgreSQL 16, Docker Compose, `just`.

## Building & Testing

- **Quick Start**: `docker compose up --build`
- **Native Setup**: `just install && just db && just server-migrate`
- **Testing Mandate**:
    - **Backend**: Unit tests in `tests/unit/` (mocked DB), integration tests in `tests/integration/`.
    - **Frontend**: Component/Store tests using Vitest/Testing Library.
    - **Rule**: Implement tests and code in the same task. Run tests before marking a task complete.

## Naming & Conventions

- **Python**: `snake_case` for files/functions, `PascalCase` for classes.
- **TS/React**: `kebab-case` for utility files, `PascalCase` for components.
- **JSON**: API outputs must be `camelCase` (configured via Pydantic alias generator).
- **Database**: Tables are `snake_case` plural.

Refer to `docs/` and `features/` for detailed specifications before implementation.
