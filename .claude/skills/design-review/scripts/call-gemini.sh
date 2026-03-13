#!/usr/bin/env bash
# call-gemini.sh — Gemini CLI 调用封装
# Usage: bash call-gemini.sh "YOUR_PROMPT_HERE"
#
# Features:
#   - 超时控制（默认 120 秒）
#   - 错误处理与退出码
#   - stderr 捕获

set -euo pipefail

PROMPT="${1:?Error: prompt argument required}"
TIMEOUT="${GEMINI_TIMEOUT:-120}"

if ! command -v gemini &>/dev/null; then
    echo "ERROR: gemini CLI not found. Install with: npm install -g @anthropic-ai/gemini-cli or check PATH" >&2
    exit 1
fi

# Run gemini with timeout
if timeout "${TIMEOUT}" gemini -p "${PROMPT}" 2>&1; then
    exit 0
else
    EXIT_CODE=$?
    if [ "$EXIT_CODE" -eq 124 ]; then
        echo "ERROR: Gemini CLI timed out after ${TIMEOUT}s" >&2
    else
        echo "ERROR: Gemini CLI exited with code ${EXIT_CODE}" >&2
    fi
    exit "$EXIT_CODE"
fi
