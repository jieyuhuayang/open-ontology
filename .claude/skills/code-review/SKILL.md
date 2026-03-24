---
name: code-review
description: >-
  Multi-AI parallel code review using Codex CLI and Gemini CLI.
  Reviews code changes across 6 dimensions: boundary conditions, permission/auth,
  concurrency, log leakage, test coverage gaps, and project code style conventions.
  Supports uncommitted changes, branch diffs, specific commits, and file lists.
  Usage: /code-review [--base <branch>] [--commit <sha>] [--files file1 file2]
  TRIGGER when: user asks to review code, review a PR, check code quality, or uses /code-review.
  DO NOT TRIGGER when: user asks to review SDD documents (use sdd-review instead).
---

# Multi-AI Code Review Skill

## Step 1: Parse Arguments

Extract review mode from user input:
- No args or `--uncommitted` → review uncommitted changes (staged + unstaged + untracked)
- `--base <branch>` → review changes relative to the given base branch
- `--commit <sha>` → review changes introduced by a specific commit
- `--files file1 file2 ...` → review specific files (full content)

If no arguments provided, default to uncommitted changes.

## Step 2: Build Review Prompt

Run the build-prompt.sh script to collect diff and assemble the review prompt:

```bash
bash .claude/skills/code-review/scripts/build-prompt.sh [ARGS]
```

Where `[ARGS]` matches the parsed mode:
- Uncommitted: no args
- Base branch: `--base <branch>`
- Commit: `--commit <sha>`
- Files: `--files file1 file2 ...`

If the script outputs `NO_CHANGES`, inform the user there are no changes to review and stop.

Read the generated prompt file at `/tmp/code-review-prompt.md` to verify it was created successfully.

## Step 3: Check Tool Availability

Check which AI tools are available:
```bash
which codex 2>/dev/null && echo "CODEX_OK" || echo "CODEX_MISSING"
which gemini 2>/dev/null && echo "GEMINI_OK" || echo "GEMINI_MISSING"
```

Record availability status for the report header.

## Step 4: Launch Parallel AI Reviews

Based on the review mode and tool availability, launch reviews **in parallel** (make both Bash calls in a single response):

### Codex Review

**Always use `codex exec`** — `codex review` does not support passing a custom prompt alongside `--base`/`--commit` flags. Using `exec` with the assembled prompt ensures consistent behavior across all modes.

```bash
codex exec -s read-only --ephemeral "$(cat /tmp/code-review-prompt.md)" > /tmp/code-review-codex.md 2>&1
```

**Important**: Set a timeout of 300000ms (5 minutes) for the codex call.

> **Lesson learned**: `codex review --base <branch> "prompt"` fails with "cannot be used with [PROMPT]". The `review` subcommand generates its own prompt from the diff; it cannot accept an external prompt. Always use `codex exec` with our assembled prompt instead.

### Gemini Review

For all modes:
```bash
gemini -p "$(cat /tmp/code-review-prompt.md)" --sandbox=none -o text > /tmp/code-review-gemini.md 2>&1
```

**Important**: Set a timeout of 300000ms (5 minutes) for the gemini call.

### Fallback Behavior

- If **both tools unavailable**: Read the checklists from `references/` directory and perform the review yourself (Claude) using the same 6-dimension framework. Output the report directly.
- If **one tool fails or times out**: Use the successful tool's output. Mark the failed tool as `[TIMEOUT]` or `[ERROR]` in the report.
- If **one tool unavailable**: Run only the available tool. Mark the unavailable tool in the report header.

## Step 5: Read and Analyze Results

Read both output files:
- `/tmp/code-review-codex.md`
- `/tmp/code-review-gemini.md`

## Step 6: Generate Unified Report

Synthesize the two review outputs into a single unified report. Apply these rules:

### Deduplication
- If both tools flag the **same file and approximately the same line** for the **same type of issue**, merge into a single finding and mark it `[Codex+Gemini]` (higher confidence).
- If only one tool flags an issue, attribute it: `[Codex]` or `[Gemini]`.

### Severity Classification
- **HIGH**: Security vulnerabilities, data corruption risks, race conditions, production crashes
- **MEDIUM**: Convention violations, missing tests, potential bugs that won't crash immediately
- **LOW**: Style nits, minor improvements, suggestions

### Report Format

Output the report in this format:

```
# Code Review Report

**Review scope**: <description of what was reviewed>
**Changed files**: <count>
**Tools**: Codex <OK|MISSING|TIMEOUT|ERROR> | Gemini <OK|MISSING|TIMEOUT|ERROR>

## Summary
| Dimension | High | Medium | Low | Status |
|-----------|------|--------|-----|--------|
| Boundary Conditions | 0 | 0 | 0 | PASS |
| Permission & Auth | 0 | 0 | 0 | PASS |
| Concurrency | 0 | 0 | 0 | PASS |
| Log & Info Leakage | 0 | 0 | 0 | PASS |
| Test Coverage | 0 | 0 | 0 | PASS |
| Code Style | 0 | 0 | 0 | PASS |

**Overall**: PASS / PASS_WITH_WARNINGS / NEEDS_FIX

## Detailed Findings

### HIGH Severity
(list findings or "None")

### MEDIUM Severity
(list findings or "None")

### LOW Severity
(list findings or "None")
```

Each finding should include:
- `[Source]` — `[Codex]`, `[Gemini]`, or `[Codex+Gemini]`
- `[DIMENSION]` — which checklist category
- `file:line` — location
- Description of the issue
- Suggested fix (brief)

### Overall Assessment Rules
- **PASS**: No HIGH or MEDIUM findings
- **PASS_WITH_WARNINGS**: MEDIUM findings only (no HIGH)
- **NEEDS_FIX**: Any HIGH findings

## Error Handling

| Scenario | Action |
|----------|--------|
| No changes to review | Print message and stop |
| Both tools unavailable | Claude performs review directly using checklists |
| One tool times out | Use other tool's output, mark [TIMEOUT] |
| Diff too large (>50 files) | Warn user, proceed with truncated diff |
| build-prompt.sh fails | Report error, attempt manual diff collection |
