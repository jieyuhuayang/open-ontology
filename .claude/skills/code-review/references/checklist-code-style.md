# Code Style & Project Conventions Checklist (Open Ontology Specific)

Review the changed code for the following project convention violations:

1. **Naming conventions** - Python files: `snake_case.py`, Python classes: `PascalCase`, TS utils: `kebab-case.ts`, React components: `PascalCase.tsx`, DB tables: `snake_case` plural, API paths: `/api/v1/kebab-case`, error codes: `UPPER_SNAKE` with module prefix.
2. **Serialization convention** - Python internal: `snake_case`. API JSON output: `camelCase`. Must use Pydantic `alias_generator=to_camel` + `populate_by_name=True`. No manual field renaming.
3. **Layer violation (backend)** - Routers must only do HTTP parsing and delegate to services. Services contain business logic. Domain is pure (no I/O). Storage handles DB queries. No reverse imports (storage must not import services, services must not import routers).
4. **Layer violation (frontend)** - Server data must live in TanStack Query cache, NOT in Zustand. Zustand is only for UI state (modal open/close, selected row, etc.).
5. **i18n compliance** - All user-visible strings must use `t('key')`. No hardcoded Chinese or English strings in components.
6. **API type generation** - Frontend API types must come from `openapi.json` generation pipeline. No hand-written API request/response types.
7. **Primary key format** - Must use `rid` (text, format: `ri.<namespace>.<type>.<uuid4>`). No auto-increment IDs.
8. **Database migrations** - Schema changes must go through Alembic migrations. No raw DDL.
9. **Error response format** - Must follow `{ "error": { "code": "UPPER_SNAKE", "message": "...", "details": {} } }`.
10. **Business logic in routers** - Routers must not contain business logic, validation beyond HTTP parsing, or direct database access. All must be delegated to service layer.
