#!/usr/bin/env bash
# call-codex.sh — Codex CLI 调用封装
# Usage: bash call-codex.sh "YOUR_PROMPT_HERE"
#
# Features:
#   - 超时控制（默认 120 秒）
#   - 通过 stdin heredoc 传递长提示词
#   - read-only sandbox 模式
#   - 错误处理与退出码

set -euo pipefail

PROMPT="${1:?Error: prompt argument required}"
TIMEOUT="${CODEX_TIMEOUT:-120}"

if ! command -v codex &>/dev/null; then
    echo "ERROR: codex CLI not found. Install with: npm install -g @openai/codex or check PATH" >&2
    exit 1
fi

# Run codex with timeout, passing prompt via stdin
if timeout "${TIMEOUT}" bash -c 'cat <<'"'"'PROMPT'"'"' | codex exec --sandbox read-only - 2>&1
'"${PROMPT}"'
PROMPT'; then
    exit 0
else
    EXIT_CODE=$?
    if [ "$EXIT_CODE" -eq 124 ]; then
        echo "ERROR: Codex CLI timed out after ${TIMEOUT}s" >&2
    else
        echo "ERROR: Codex CLI exited with code ${EXIT_CODE}" >&2
    fi
    exit "$EXIT_CODE"
fi
