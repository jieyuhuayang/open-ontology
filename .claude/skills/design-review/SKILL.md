---
name: design-review
description: This skill should be used when the user asks to "review a design", "get design feedback", "evaluate UI/UX", "check interaction design", mentions "design review", "design critique", "taste check", or wants external AI perspectives on visual design, interaction flows, component aesthetics, or user experience quality.
version: 1.0.0
tools: Bash, Read, Glob, Grep, Agent
---

# Design Review — Multi-AI Design Critics

You are orchestrating a design review session where Gemini and Codex act as independent UI/UX critics. The goal is to get diverse, high-quality feedback across **6 review dimensions** (see `references/review-dimensions.md`) that elevates the design's taste, creative spirit, and technical quality.

## When to Use

- User asks for design feedback, critique, or review
- A UI/UX proposal, mockup, or interaction flow needs external perspective
- User wants to validate design decisions before implementation
- Component aesthetics, interaction quality, or visual refinement needs evaluation

## Review Workflow

### Step 1: Gather the Design Context

Before calling the reviewers, assemble a clear brief. Read the relevant files and construct a context block that includes:

- **What it is**: The component/page/feature being designed
- **Current state**: What exists now (screenshot description, existing code, or "greenfield")
- **Design direction**: Aesthetic goals, brand language, constraints
- **Specific files**: Paste or summarize the actual code/plan/mockup content
- **What you want reviewed**: Be specific — "Is the toolbar expansion interaction natural?" is better than "Review this design"

Keep the brief under 2000 words. Both CLIs have context limits, and a focused brief gets better feedback than a data dump.

### Step 2: Craft Differentiated Review Prompts

Each reviewer gets a different set of 3 dimensions (out of 6 total) to maximize coverage and minimize overlap. Refer to `references/prompt-templates.md` for the full prompt templates.

**Gemini** reviews dimensions 1, 3, 5:
- Interaction Fluidity (交互流畅度)
- Emotional Resonance (情感共鸣)
- Accessibility (可访问性)

**Codex** reviews dimensions 2, 4, 6:
- Visual Refinement (视觉精致度)
- Technical Feasibility (技术可行性)
- Design System Consistency (设计系统一致性)

Do NOT share your own design conclusions or preferences — let them form independent opinions.

### Step 3: Call Both Reviewers in Parallel

Launch both in a single turn for efficiency. Use the shell scripts in `scripts/`:

```bash
# Gemini
bash .claude/skills/design-review/scripts/call-gemini.sh "PROMPT_HERE" 2>&1

# Codex
bash .claude/skills/design-review/scripts/call-codex.sh "PROMPT_HERE" 2>&1
```

Or use the CLI directly:

**Gemini** (non-interactive mode with `-p`):
```bash
gemini -p "PROMPT_HERE" 2>&1
```

**Codex** (exec mode, read-only sandbox, stdin for long prompts):
```bash
cat <<'PROMPT' | codex exec --sandbox read-only - 2>&1
PROMPT_HERE
PROMPT
```

### Step 4: Synthesize the Feedback

After both reviews return, synthesize using the structured methodology in `references/synthesis-guide.md`. The synthesis should:

1. **Score each dimension** — Rate each of the 6 dimensions (1-5) based on reviewer feedback
2. **Identify consensus** — Where both reviewers agree, the signal is strong
3. **Highlight unique insights** — Each reviewer's best idea that the other missed
4. **Resolve contradictions** — If they disagree, explain both perspectives and recommend a direction
5. **Prioritize via impact matrix** — Rank improvements by impact-to-effort ratio
6. **Extract bold ideas** — Present both reviewers' bold ideas and assess feasibility

Format the synthesis as a clear, scannable summary the user can act on. Lead with the highest-impact changes.

### Step 5: Propose Design Updates

Based on the synthesis, propose specific changes to the design files. For each change:
- Reference which reviewer(s) inspired it
- Note which dimension(s) it improves
- Explain what it improves (taste, delight, clarity, etc.)
- Give the exact code/CSS/copy change if applicable

Ask the user which improvements they'd like to apply before making any changes.

## Important Notes

- **Independence is key**: Never tell the reviewers what you think the answer should be. The whole point is getting fresh eyes.
- **Context matters**: The more specific your brief, the more specific the feedback. "Review this form" gets generic advice. "This glassmorphism card appears above a 3D starfield canvas at bottom-center; the color swatches feel too flat against the cosmic aesthetic" gets targeted suggestions.
- **Don't over-optimize**: Not every piece of feedback needs to be acted on. The user decides what aligns with their vision.
- **Language**: Write the review prompts in the same language the user is using (Chinese or English).
- **Dimension coverage**: Ensure feedback covers all 6 dimensions. If a reviewer skips a dimension, note it in the synthesis as a gap.
