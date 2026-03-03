#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env.mysql-sample.local}"
RUNTIME_DIR="${SCRIPT_DIR}/runtime"
REPORT_FILE="${RUNTIME_DIR}/refresh-report.tsv"
SCHEMA_FILE="${RUNTIME_DIR}/schema.sql"
DATA_DIR="${RUNTIME_DIR}/data"

if [[ "${1:-}" == "--help" ]]; then
    cat <<'EOF'
Usage:
  bash ops/mysql-sample/refresh.sh

Optional environment overrides:
  ENV_FILE=/path/to/.env.mysql-sample.local

This script:
  1. Starts or reuses a local MySQL container.
  2. Recreates the target sample database.
  3. Imports source schema.
  4. Imports up to SAMPLE_LIMIT newest rows per table.
  5. Writes a row-count report to ops/mysql-sample/runtime/refresh-report.tsv.
EOF
    exit 0
fi

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Missing env file: ${ENV_FILE}" >&2
    echo "Create it from: ${SCRIPT_DIR}/.env.mysql-sample.example" >&2
    exit 1
fi

set -a
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +a

required_vars=(
    SOURCE_MYSQL_HOST
    SOURCE_MYSQL_PORT
    SOURCE_MYSQL_DB
    SOURCE_MYSQL_USER
    SOURCE_MYSQL_PASSWORD
    TARGET_MYSQL_ROOT_PASSWORD
)

for var_name in "${required_vars[@]}"; do
    if [[ -z "${!var_name:-}" ]]; then
        echo "Required variable is empty: ${var_name}" >&2
        exit 1
    fi
done

TARGET_CONTAINER_NAME="${TARGET_CONTAINER_NAME:-openontology-mysql-sample}"
TARGET_VOLUME_NAME="${TARGET_VOLUME_NAME:-openontology_mysql_sample_data}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:8.0.37}"
TARGET_MYSQL_PORT="${TARGET_MYSQL_PORT:-13306}"
TARGET_MYSQL_DB="${TARGET_MYSQL_DB:-cofco_grease_mvp_sample}"
TARGET_MYSQL_USER="${TARGET_MYSQL_USER:-oo_sample}"
TARGET_MYSQL_PASSWORD="${TARGET_MYSQL_PASSWORD:-oo_sample}"
SAMPLE_LIMIT="${SAMPLE_LIMIT:-100}"

mkdir -p "${RUNTIME_DIR}" "${DATA_DIR}"
rm -f "${REPORT_FILE}" "${SCHEMA_FILE}"
rm -rf "${DATA_DIR}"
mkdir -p "${DATA_DIR}"

sql_quote() {
    local value="$1"
    printf "%s" "${value//\'/\'\'}"
}

escape_ident() {
    local ident="$1"
    printf "%s" "${ident//\`/\`\`}"
}

mysql_source_query() {
    local query="$1"
    MYSQL_PWD="${SOURCE_MYSQL_PASSWORD}" mysql \
        --batch --raw --skip-column-names \
        -h "${SOURCE_MYSQL_HOST}" \
        -P "${SOURCE_MYSQL_PORT}" \
        -u "${SOURCE_MYSQL_USER}" \
        -D "${SOURCE_MYSQL_DB}" \
        -e "${query}"
}

mysql_target_exec() {
    local query="$1"
    docker exec \
        -e MYSQL_PWD="${TARGET_MYSQL_ROOT_PASSWORD}" \
        "${TARGET_CONTAINER_NAME}" \
        mysql --batch --raw --skip-column-names \
        -uroot \
        -D "${TARGET_MYSQL_DB}" \
        -e "${query}"
}

wait_target_ready() {
    local attempts=60
    local i
    for ((i = 1; i <= attempts; i++)); do
        if docker exec \
            -e MYSQL_PWD="${TARGET_MYSQL_ROOT_PASSWORD}" \
            "${TARGET_CONTAINER_NAME}" \
            mysqladmin ping -uroot --silent >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    return 1
}

ensure_container() {
    if docker ps -a --format '{{.Names}}' | grep -Fxq "${TARGET_CONTAINER_NAME}"; then
        if ! docker ps --format '{{.Names}}' | grep -Fxq "${TARGET_CONTAINER_NAME}"; then
            docker start "${TARGET_CONTAINER_NAME}" >/dev/null
        fi
    else
        docker run -d \
            --name "${TARGET_CONTAINER_NAME}" \
            -p "${TARGET_MYSQL_PORT}:3306" \
            -e MYSQL_ROOT_PASSWORD="${TARGET_MYSQL_ROOT_PASSWORD}" \
            -e MYSQL_DATABASE="${TARGET_MYSQL_DB}" \
            -e MYSQL_USER="${TARGET_MYSQL_USER}" \
            -e MYSQL_PASSWORD="${TARGET_MYSQL_PASSWORD}" \
            -v "${TARGET_VOLUME_NAME}:/var/lib/mysql" \
            "${MYSQL_IMAGE}" >/dev/null
    fi

    if ! wait_target_ready; then
        echo "Target MySQL container did not become ready: ${TARGET_CONTAINER_NAME}" >&2
        exit 1
    fi
}

setup_target_database() {
    local source_db_q
    source_db_q="$(sql_quote "${SOURCE_MYSQL_DB}")"

    local source_charset
    local source_collation
    source_charset="$(
        mysql_source_query \
            "SELECT DEFAULT_CHARACTER_SET_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${source_db_q}'"
    )"
    source_collation="$(
        mysql_source_query \
            "SELECT DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${source_db_q}'"
    )"

    if [[ -z "${source_charset}" ]]; then
        source_charset="utf8mb3"
    fi
    if [[ -z "${source_collation}" ]]; then
        source_collation="utf8mb3_bin"
    fi

    local target_db_ident
    target_db_ident="$(escape_ident "${TARGET_MYSQL_DB}")"

    docker exec \
        -e MYSQL_PWD="${TARGET_MYSQL_ROOT_PASSWORD}" \
        "${TARGET_CONTAINER_NAME}" \
        mysql -uroot -e "DROP DATABASE IF EXISTS \`${target_db_ident}\`; CREATE DATABASE \`${target_db_ident}\` CHARACTER SET ${source_charset} COLLATE ${source_collation};"
}

dump_schema() {
    MYSQL_PWD="${SOURCE_MYSQL_PASSWORD}" mysqldump \
        --no-data \
        --single-transaction \
        --set-gtid-purged=OFF \
        --skip-comments \
        -h "${SOURCE_MYSQL_HOST}" \
        -P "${SOURCE_MYSQL_PORT}" \
        -u "${SOURCE_MYSQL_USER}" \
        "${SOURCE_MYSQL_DB}" >"${SCHEMA_FILE}"

    docker exec -i \
        -e MYSQL_PWD="${TARGET_MYSQL_ROOT_PASSWORD}" \
        "${TARGET_CONTAINER_NAME}" \
        mysql -uroot "${TARGET_MYSQL_DB}" <"${SCHEMA_FILE}"
}

build_order_clause() {
    local table_name="$1"
    local db_q table_q
    db_q="$(sql_quote "${SOURCE_MYSQL_DB}")"
    table_q="$(sql_quote "${table_name}")"

    local -a order_cols=()
    local -a candidates
    local -a pk_cols
    local first_col
    local col

    mapfile -t candidates < <(
        mysql_source_query "
SELECT COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA='${db_q}'
  AND TABLE_NAME='${table_q}'
  AND COLUMN_NAME IN (
      'update_time','updated_at','gmt_modified','modified_at',
      'insert_time','created_at','create_time','gmt_create',
      't_date','date_time'
  )
ORDER BY FIELD(
    COLUMN_NAME,
    'update_time','updated_at','gmt_modified','modified_at',
    'insert_time','created_at','create_time','gmt_create',
    't_date','date_time'
), ORDINAL_POSITION
"
    )

    for col in "${candidates[@]}"; do
        [[ -z "${col}" ]] && continue
        order_cols+=("${col}")
    done

    mapfile -t pk_cols < <(
        mysql_source_query "
SELECT COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA='${db_q}'
  AND TABLE_NAME='${table_q}'
  AND CONSTRAINT_NAME='PRIMARY'
ORDER BY ORDINAL_POSITION
"
    )

    for col in "${pk_cols[@]}"; do
        [[ -z "${col}" ]] && continue
        if [[ ! " ${order_cols[*]} " =~ [[:space:]]${col}[[:space:]] ]]; then
            order_cols+=("${col}")
        fi
    done

    if [[ "${#order_cols[@]}" -eq 0 ]]; then
        first_col="$(
            mysql_source_query "
SELECT COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA='${db_q}'
  AND TABLE_NAME='${table_q}'
ORDER BY ORDINAL_POSITION
LIMIT 1
"
        )"
        if [[ -n "${first_col}" ]]; then
            order_cols+=("${first_col}")
        fi
    fi

    local -a escaped_cols=()
    for col in "${order_cols[@]}"; do
        escaped_cols+=("\`$(escape_ident "${col}")\` DESC")
    done

    local order_clause
    order_clause="$(IFS=', '; printf "%s" "${escaped_cols[*]}")"
    printf "%s" "${order_clause}"
}

dump_and_import_table_sample() {
    local table_name="$1"
    local table_file="${DATA_DIR}/$(printf "%s" "${table_name}" | tr '/ ' '__').sql"

    local order_clause
    order_clause="$(build_order_clause "${table_name}")"
    if [[ -z "${order_clause}" ]]; then
        echo "Skipping table with no columns: ${table_name}" >&2
        return
    fi

    MYSQL_PWD="${SOURCE_MYSQL_PASSWORD}" mysqldump \
        --no-create-info \
        --skip-triggers \
        --single-transaction \
        --set-gtid-purged=OFF \
        --skip-comments \
        -h "${SOURCE_MYSQL_HOST}" \
        -P "${SOURCE_MYSQL_PORT}" \
        -u "${SOURCE_MYSQL_USER}" \
        "${SOURCE_MYSQL_DB}" \
        "${table_name}" \
        --where="1 ORDER BY ${order_clause} LIMIT ${SAMPLE_LIMIT}" >"${table_file}"

    docker exec -i \
        -e MYSQL_PWD="${TARGET_MYSQL_ROOT_PASSWORD}" \
        "${TARGET_CONTAINER_NAME}" \
        mysql -uroot "${TARGET_MYSQL_DB}" <"${table_file}"
}

write_report_header() {
    printf "table\trow_count\tlimit\tstatus\n" >"${REPORT_FILE}"
}

append_report_row() {
    local table_name="$1"
    local row_count="$2"
    local status="$3"
    printf "%s\t%s\t%s\t%s\n" "${table_name}" "${row_count}" "${SAMPLE_LIMIT}" "${status}" >>"${REPORT_FILE}"
}

main() {
    echo "[1/6] Ensuring local MySQL sample container..."
    ensure_container

    echo "[2/6] Recreating target sample database..."
    setup_target_database

    echo "[3/6] Importing source schema..."
    dump_schema

    echo "[4/6] Enumerating source tables..."
    local source_db_q
    source_db_q="$(sql_quote "${SOURCE_MYSQL_DB}")"
    local -a tables
    mapfile -t tables < <(
        mysql_source_query "
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA='${source_db_q}'
  AND TABLE_TYPE='BASE TABLE'
ORDER BY TABLE_NAME
"
    )

    echo "[5/6] Copying sampled rows (limit=${SAMPLE_LIMIT} per table)..."
    write_report_header
    local table_name row_count status
    for table_name in "${tables[@]}"; do
        [[ -z "${table_name}" ]] && continue
        dump_and_import_table_sample "${table_name}"
        row_count="$(mysql_target_exec "SELECT COUNT(*) FROM \`$(escape_ident "${table_name}")\`;")"
        if [[ "${row_count}" -le "${SAMPLE_LIMIT}" ]]; then
            status="ok"
        else
            status="exceeded"
        fi
        append_report_row "${table_name}" "${row_count}" "${status}"
        printf "  - %-40s %s rows\n" "${table_name}" "${row_count}"
    done

    echo "[6/6] Completed."
    echo
    echo "Sample DB is ready for Open Ontology import testing:"
    echo "  host: 127.0.0.1"
    echo "  port: ${TARGET_MYSQL_PORT}"
    echo "  database: ${TARGET_MYSQL_DB}"
    echo "  username: ${TARGET_MYSQL_USER}"
    echo "  password: (from ${ENV_FILE})"
    echo
    echo "Report: ${REPORT_FILE}"
}

main "$@"
