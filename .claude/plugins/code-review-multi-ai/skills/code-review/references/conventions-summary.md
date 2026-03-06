# Open Ontology Project Conventions (Summary for Code Review)

## Architecture
- Backend layers (top-down only): Routers -> Services -> Domain/Storage. No reverse imports.
- Routers: HTTP parsing only, delegate to services. No business logic.
- Services: Business logic + transaction boundaries.
- Domain: Pydantic models, pure logic, no I/O.
- Storage: SQLAlchemy async queries, returns domain models.

## Naming
- Python: snake_case files, PascalCase classes. TS: kebab-case utils, PascalCase components.
- API paths: /api/v1/kebab-case. DB tables: snake_case plural. Error codes: UPPER_SNAKE with module prefix.

## Serialization
- Python internal: snake_case. API JSON: camelCase (via Pydantic alias_generator).

## Database
- Primary keys: rid TEXT (ri.<namespace>.<type>.<uuid4>). No auto-increment.
- Schema changes via Alembic only. Async SQLAlchemy + asyncpg only.

## Frontend
- Server state in TanStack Query, UI-only state in Zustand.
- API types generated from openapi.json. No hand-written API types.
- All user-visible strings via i18n t('key').

## Error Format
- { "error": { "code": "UPPER_SNAKE", "message": "...", "details": {} } }

## Tech Stack
- Frontend: React 18 + TS, Ant Design 5, TanStack Query v5, Zustand v5, Vite, pnpm
- Backend: Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 async, uv
- DB: PostgreSQL 16+
