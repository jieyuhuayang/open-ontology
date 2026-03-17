#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# load.sh — Load finance sample SQL into the local MySQL container
#
# Usage:  bash ops/mysql-sample/finance/load.sh
#
# Reads credentials from ../.env.mysql-sample.local
# Reuses the existing Docker container (openontology-mysql-sample)
# Creates database "finance_sample" (idempotent: DROP + CREATE)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_DIR="${SCRIPT_DIR}/sql"
ENV_FILE="${SCRIPT_DIR}/../.env.mysql-sample.local"

# ── Load env ──────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Missing env file: $ENV_FILE"
  echo "   Copy .env.mysql-sample.example → .env.mysql-sample.local and fill in values."
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

CONTAINER="${TARGET_CONTAINER_NAME:-openontology-mysql-sample}"
ROOT_PWD="${TARGET_MYSQL_ROOT_PASSWORD:-oo_sample_root}"
DB_NAME="finance_sample"

# ── Check container is running ────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ Container '${CONTAINER}' is not running."
  echo "   Start it first:  bash ops/mysql-sample/refresh.sh  (or docker start ${CONTAINER})"
  exit 1
fi

echo "🏦 Loading finance sample data into MySQL container '${CONTAINER}'..."

# ── Recreate database (idempotent) ────────────────────────────
echo "  → Recreating database '${DB_NAME}'..."
docker exec -i "$CONTAINER" mysql --default-character-set=utf8mb4 -uroot -p"${ROOT_PWD}" <<SQL
DROP DATABASE IF EXISTS \`${DB_NAME}\`;
CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO 'oo_sample'@'%';
FLUSH PRIVILEGES;
SQL

# ── Execute SQL files in order ────────────────────────────────
for sql_file in "$SQL_DIR"/0*.sql; do
  fname="$(basename "$sql_file")"
  echo "  → Executing ${fname}..."
  docker exec -i "$CONTAINER" mysql -uroot -p"${ROOT_PWD}" "$DB_NAME" < "$sql_file"
done

# ── Verify ────────────────────────────────────────────────────
echo ""
echo "✅ Done! Verifying row counts:"
docker exec -i "$CONTAINER" mysql -uroot -p"${ROOT_PWD}" "$DB_NAME" <<'SQL'
SELECT 'companies' AS tbl, COUNT(*) AS cnt FROM companies
UNION ALL SELECT 'analysts', COUNT(*) FROM analysts
UNION ALL SELECT 'rating_reports', COUNT(*) FROM rating_reports
UNION ALL SELECT 'funds', COUNT(*) FROM funds
UNION ALL SELECT 'fund_company_holdings', COUNT(*) FROM fund_company_holdings;
SQL

echo ""
echo "🔗 Connection info for Open Ontology UI:"
echo "   Host: 127.0.0.1"
echo "   Port: ${TARGET_MYSQL_PORT:-13306}"
echo "   Database: ${DB_NAME}"
echo "   User: root"
echo "   Password: ${ROOT_PWD}"
