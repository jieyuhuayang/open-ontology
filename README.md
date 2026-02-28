# Open Ontology

An open-source ontology platform for the agent era — providing a business-centric unified data modeling framework so that users and LLM-based agents can share standardized business terms.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker | 24+ | [docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | v2+ | Included with Docker Desktop |
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| pnpm | 9+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| Python | 3.12+ | [python.org](https://www.python.org/) |
| uv | 0.5+ | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Just | 1.0+ | `brew install just` or [github.com/casey/just](https://github.com/casey/just) |

## Quick Start

### Option A: Docker Compose (recommended)

One command to start everything:

```bash
docker compose up --build
```

This starts:
- **PostgreSQL 16** on `localhost:5432`
- **FastAPI backend** on `localhost:8000` (with Swagger UI at `/docs`)
- **Vite dev server** on `localhost:5173`

### Option B: Native Development

1. Start the database:

```bash
just db
```

2. Install dependencies (first time only):

```bash
just install
```

3. Run database migrations:

```bash
just server-migrate
```

4. Start backend and frontend in separate terminals:

```bash
just server-dev   # Terminal 1: FastAPI on :8000
just web-dev      # Terminal 2: Vite on :5173
```

## Available Commands

Run `just` to see all available commands:

| Command | Description |
|---------|-------------|
| `just up` | Start all services via Docker Compose |
| `just up-build` | Start with rebuild |
| `just down` | Stop all services |
| `just db` | Start only PostgreSQL |
| `just server-dev` | Run backend natively (requires DB) |
| `just web-dev` | Run frontend natively |
| `just test` | Run all tests |
| `just server-test` | Run backend tests |
| `just web-test` | Run frontend tests |
| `just install` | Install all dependencies |
| `just server-migrate` | Run database migrations |
| `just server-openapi` | Generate openapi.json |
| `just web-typegen` | Generate TS types from OpenAPI |

## Project Structure

```
apps/
├── server/       # FastAPI backend (Python)
│   ├── app/      # Application code
│   ├── alembic/  # Database migrations
│   └── tests/    # Backend tests
├── web/          # React frontend (TypeScript)
│   ├── src/      # Application code
│   └── tests/    # Frontend tests
docs/             # Architecture & PRD documents
features/         # Feature specifications
```

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2
- **Frontend**: React 18, TypeScript, Ant Design 5, TanStack Query v5, Zustand v5, Vite
- **Database**: PostgreSQL 16
- **Tooling**: pnpm workspaces, uv, Just, Docker Compose
