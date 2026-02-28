# Open Ontology — Development Task Runner

# Default: show available commands
default:
    @just --list

# --- Docker Compose ---

# Start all services
up:
    docker compose up

# Start all services with rebuild
up-build:
    docker compose up --build

# Start all services in background
up-detach:
    docker compose up -d

# Stop all services
down:
    docker compose down

# Stop all services and remove volumes
down-volumes:
    docker compose down -v

# Start only the database
db:
    docker compose up db

# --- Native Development ---

# Start backend dev server (requires DB running)
server-dev:
    cd apps/server && uv run uvicorn app.main:app --reload --port 8000

# Start frontend dev server
web-dev:
    cd apps/web && pnpm dev

# --- Testing ---

# Run backend tests
server-test:
    cd apps/server && uv run pytest

# Run frontend tests
web-test:
    cd apps/web && pnpm test

# Run all tests
test: server-test web-test

# --- Dependencies ---

# Install all dependencies
install:
    cd apps/server && uv sync --all-extras
    cd apps/web && pnpm install

# --- Database ---

# Run database migrations
server-migrate:
    cd apps/server && uv run alembic upgrade head

# Create a new migration
server-migration name:
    cd apps/server && uv run alembic revision --autogenerate -m "{{name}}"

# --- Code Generation ---

# Generate openapi.json from FastAPI
server-openapi:
    cd apps/server && uv run python -c "import json; from app.main import app; from fastapi.openapi.utils import get_openapi; print(json.dumps(get_openapi(title=app.title, version=app.version, routes=app.routes), indent=2))" > openapi.json

# Generate TypeScript types from openapi.json
web-typegen:
    cd apps/web && pnpm exec openapi-typescript ../../apps/server/openapi.json -o src/generated/api.ts

# --- Feature Status ---

# Show feature status (derived from tasks.md in each feature directory)
features-status:
    #!/usr/bin/env bash
    printf "%-6s %-45s %s\n" "#" "Feature" "Status"
    printf "%-6s %-45s %s\n" "---" "---------------------------------------------" "----------"
    for dir in features/v0.1.0/*/; do
        name=$(basename "$dir")
        tasks="$dir/tasks.md"
        if [ ! -f "$tasks" ]; then
            status="📝 Draft"
        else
            total=$(grep -c '^\- \[' "$tasks" 2>/dev/null || echo 0)
            done=$(grep -c '^\- \[x\]' "$tasks" 2>/dev/null || echo 0)
            if [ "$total" -eq 0 ]; then
                status="📝 Draft"
            elif [ "$done" -eq "$total" ]; then
                status="✅ Done ($done/$total)"
            elif [ "$done" -gt 0 ]; then
                status="🚧 In Progress ($done/$total)"
            else
                status="📋 Planned (0/$total)"
            fi
        fi
        printf "%-6s %-45s %s\n" "${name%%-*}" "${name#*-}" "$status"
    done
