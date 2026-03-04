#!/bin/bash
# =============================================================================
# arch-guard.sh — 架构守卫脚本
#
# 调用方：.claude/settings.json 中的 PostToolUse 同步 hook
# 触发时机：Claude Code 使用 Write / Edit / NotebookEdit 工具写入文件后立即执行
# 执行方式：同步（阻塞），确保警告在 Claude 下次操作前就可见
#
# 目的：自动检测最高优先级架构红线违规，即时反馈给开发者，
#       避免违规被 auto-commit 固化进历史。
#       无违规时完全静默，不产生噪音。
# =============================================================================
FILE="$1"
[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git -C "$(dirname "$FILE")" rev-parse --show-toplevel 2>/dev/null)}"

# ── 检查 1：Router → Storage 直接导入（P0 红线）────────────────────────────
# CLAUDE.md 强制约束：routers 只能调用 services，不得绕过 service 层直接操作数据库
# 违规信号：routers/*.py 中出现 "from app.storage..." 顶级导入
if [[ "$FILE" == *"/app/routers/"*.py ]]; then
    if grep -qE "^from app\.storage" "$FILE" 2>/dev/null; then
        echo "⚠️  [arch-guard] VIOLATION: $(basename "$FILE") 直接导入 storage 层 — 必须通过 services"
    fi
    # openapi.json 过时提醒：router 变更后若未重新生成，前端类型会与后端不一致
    OPENAPI="$REPO_ROOT/apps/server/openapi.json"
    if [[ -f "$OPENAPI" && "$FILE" -nt "$OPENAPI" ]]; then
        echo "ℹ️  [arch-guard] Router 已变更 → 记得运行: just server-openapi && just web-typegen"
    fi
fi

# ── 检查 2：Storage → Service 反向导入（P0 红线）────────────────────────────
# CLAUDE.md 强制约束：storage 层只能被 services 调用，禁止反向依赖
# 违规信号：storage/*.py 中出现 "from app.services..." 导入
if [[ "$FILE" == *"/app/storage/"*.py ]]; then
    if grep -qE "^from app\.services" "$FILE" 2>/dev/null; then
        echo "⚠️  [arch-guard] VIOLATION: $(basename "$FILE") 导入 service 层 — 反向依赖违规"
    fi
fi

# ── 检查 3：main.py 变更 → openapi 过时提醒 ─────────────────────────────────
# main.py 负责路由注册，修改它同样可能影响 API schema
if [[ "$FILE" == *"/app/main.py" ]]; then
    OPENAPI="$REPO_ROOT/apps/server/openapi.json"
    if [[ -f "$OPENAPI" && "$FILE" -nt "$OPENAPI" ]]; then
        echo "ℹ️  [arch-guard] main.py 已变更 → 记得运行: just server-openapi && just web-typegen"
    fi
fi

# ── 检查 4：禁止手动编辑生成文件 ────────────────────────────────────────────
# CLAUDE.md 强制约束：src/generated/api.ts 由 openapi-typescript 自动生成，手动修改会被下次生成覆盖
if [[ "$FILE" == *"/src/generated/api.ts" ]]; then
    echo "⚠️  [arch-guard] 正在编辑自动生成文件 — 该文件会被 just web-typegen 覆盖"
fi

exit 0
