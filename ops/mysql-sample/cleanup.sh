#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env.mysql-sample.local}"
PURGE_VOLUME=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --purge-volume)
            PURGE_VOLUME=1
            shift
            ;;
        --help)
            cat <<'EOF'
Usage:
  bash ops/mysql-sample/cleanup.sh [--purge-volume]

Options:
  --purge-volume   Also remove the Docker volume that stores MySQL data.
EOF
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

TARGET_CONTAINER_NAME="openontology-mysql-sample"
TARGET_VOLUME_NAME="openontology_mysql_sample_data"

if [[ -f "${ENV_FILE}" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "${ENV_FILE}"
    set +a
fi

TARGET_CONTAINER_NAME="${TARGET_CONTAINER_NAME:-openontology-mysql-sample}"
TARGET_VOLUME_NAME="${TARGET_VOLUME_NAME:-openontology_mysql_sample_data}"

if docker ps -a --format '{{.Names}}' | grep -Fxq "${TARGET_CONTAINER_NAME}"; then
    docker rm -f "${TARGET_CONTAINER_NAME}" >/dev/null
    echo "Removed container: ${TARGET_CONTAINER_NAME}"
else
    echo "Container not found: ${TARGET_CONTAINER_NAME}"
fi

if [[ "${PURGE_VOLUME}" -eq 1 ]]; then
    if docker volume ls --format '{{.Name}}' | grep -Fxq "${TARGET_VOLUME_NAME}"; then
        docker volume rm "${TARGET_VOLUME_NAME}" >/dev/null
        echo "Removed volume: ${TARGET_VOLUME_NAME}"
    else
        echo "Volume not found: ${TARGET_VOLUME_NAME}"
    fi
fi

rm -rf "${SCRIPT_DIR}/runtime"
echo "Removed runtime artifacts: ${SCRIPT_DIR}/runtime"
