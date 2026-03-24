#!/usr/bin/env bash
# build-prompt.sh — Collect git diff and assemble review prompt for external AI tools
# Usage:
#   build-prompt.sh                        # uncommitted changes
#   build-prompt.sh --base main            # changes relative to base branch
#   build-prompt.sh --commit <sha>         # changes in a specific commit
#   build-prompt.sh --files file1 file2    # specific files (full content)
#
# Output: writes assembled prompt to /tmp/code-review-prompt.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REFS_DIR="$SCRIPT_DIR/../references"
MAX_DIFF_LINES=3000
OUTPUT_FILE="/tmp/code-review-prompt.md"

# Always remove stale output to prevent cache poisoning
rm -f "$OUTPUT_FILE"

MODE="uncommitted"
BASE_BRANCH=""
COMMIT_SHA=""
FILES=()

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      MODE="base"
      BASE_BRANCH="$2"
      shift 2
      ;;
    --commit)
      MODE="commit"
      COMMIT_SHA="$2"
      shift 2
      ;;
    --files)
      MODE="files"
      shift
      while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
        FILES+=("$1")
        shift
      done
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# Collect diff and file list
case "$MODE" in
  uncommitted)
    DIFF_CONTENT=$(git diff HEAD 2>/dev/null || git diff)
    # Also include untracked files
    UNTRACKED=$(git ls-files --others --exclude-standard)
    if [[ -n "$UNTRACKED" ]]; then
      UNTRACKED_DIFF=""
      while IFS= read -r f; do
        if [[ -f "$f" ]]; then
          UNTRACKED_DIFF+="
--- /dev/null
+++ b/$f
$(sed 's/^/+/' "$f")
"
        fi
      done <<< "$UNTRACKED"
      DIFF_CONTENT="$DIFF_CONTENT$UNTRACKED_DIFF"
    fi
    CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || git diff --name-only)
    if [[ -n "$UNTRACKED" ]]; then
      CHANGED_FILES="$CHANGED_FILES
$UNTRACKED"
    fi
    SCOPE_DESC="Uncommitted changes (staged + unstaged + untracked)"
    ;;
  base)
    # Use two-dot syntax (BASE..HEAD) instead of three-dot (BASE...HEAD).
    # Three-dot finds the merge-base, which can include stale commits when
    # auto-save hooks create frequent commits on both main and feature branches.
    # Two-dot shows exactly "what is on HEAD but not on BASE" — the intended diff.
    DIFF_CONTENT=$(git diff "$BASE_BRANCH"..HEAD)
    CHANGED_FILES=$(git diff --name-only "$BASE_BRANCH"..HEAD)
    SCOPE_DESC="Changes relative to branch: $BASE_BRANCH"
    ;;
  commit)
    DIFF_CONTENT=$(git show "$COMMIT_SHA" --format="" --patch)
    CHANGED_FILES=$(git show "$COMMIT_SHA" --format="" --name-only)
    SCOPE_DESC="Commit: $COMMIT_SHA"
    ;;
  files)
    DIFF_CONTENT=""
    CHANGED_FILES=""
    for f in "${FILES[@]}"; do
      if [[ -f "$f" ]]; then
        DIFF_CONTENT+="
=== File: $f ===
$(cat "$f")
"
        CHANGED_FILES+="$f
"
      else
        echo "Warning: file not found: $f" >&2
      fi
    done
    SCOPE_DESC="Specific files: ${FILES[*]}"
    ;;
esac

# Check if there's anything to review
if [[ -z "$DIFF_CONTENT" || "$DIFF_CONTENT" =~ ^[[:space:]]*$ ]]; then
  echo "NO_CHANGES"
  exit 0
fi

# Count diff lines and truncate if needed
TOTAL_LINES=$(echo "$DIFF_CONTENT" | wc -l | tr -d ' ')
TRUNCATED=""
if [[ "$TOTAL_LINES" -gt "$MAX_DIFF_LINES" ]]; then
  DIFF_CONTENT=$(echo "$DIFF_CONTENT" | head -n "$MAX_DIFF_LINES")
  TRUNCATED="
**NOTE: Diff truncated from $TOTAL_LINES to $MAX_DIFF_LINES lines. Some changes may not be reviewed.**"
fi

# Count changed files
FILE_COUNT=$(echo "$CHANGED_FILES" | grep -c '[^[:space:]]' || true)

# Read conventions summary
CONVENTIONS=$(cat "$REFS_DIR/conventions-summary.md")

# Read all checklists
CHECKLIST_BOUNDARY=$(cat "$REFS_DIR/checklist-boundary.md")
CHECKLIST_PERMISSION=$(cat "$REFS_DIR/checklist-permission.md")
CHECKLIST_CONCURRENCY=$(cat "$REFS_DIR/checklist-concurrency.md")
CHECKLIST_LOG_LEAKAGE=$(cat "$REFS_DIR/checklist-log-leakage.md")
CHECKLIST_TEST_GAPS=$(cat "$REFS_DIR/checklist-test-gaps.md")
CHECKLIST_CODE_STYLE=$(cat "$REFS_DIR/checklist-code-style.md")

# Assemble the prompt
cat > "$OUTPUT_FILE" << PROMPT_EOF
# Code Review Request

## Scope
$SCOPE_DESC
Changed files ($FILE_COUNT):
$CHANGED_FILES
$TRUNCATED

## Project Conventions
$CONVENTIONS

## Review Checklists

Review the code changes below against ALL of the following checklists. For each issue found, report it in this exact format:

\`[SEVERITY] [DIMENSION] file:line — description\`

Where:
- SEVERITY: HIGH, MEDIUM, or LOW
- DIMENSION: BOUNDARY, PERMISSION, CONCURRENCY, LOG_LEAKAGE, TEST_GAPS, or CODE_STYLE

If no issues found in a dimension, state "No issues found" for that dimension.

$CHECKLIST_BOUNDARY

$CHECKLIST_PERMISSION

$CHECKLIST_CONCURRENCY

$CHECKLIST_LOG_LEAKAGE

$CHECKLIST_TEST_GAPS

$CHECKLIST_CODE_STYLE

## Code Changes

\`\`\`diff
$DIFF_CONTENT
\`\`\`

## Output Format

Provide a structured review with:
1. A summary table showing issue counts per dimension (HIGH/MEDIUM/LOW)
2. Detailed findings grouped by severity (HIGH first, then MEDIUM, then LOW)
3. An overall assessment: PASS (no high/medium), PASS_WITH_WARNINGS (medium only), or NEEDS_FIX (any high)
PROMPT_EOF

echo "$OUTPUT_FILE"
