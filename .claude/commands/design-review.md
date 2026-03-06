---
allowed-tools: Bash(gemini*), Bash(codex*), Bash(cat*), Read, Glob, Grep, Agent
description: Review UI/UX interaction design proposals by consulting Gemini and Codex as independent design critics. Use this when you have a design plan, mockup, or interaction flow that needs external perspective on taste, creativity, and user experience quality.
---

# Design Review — Multi-AI Design Critics

You are orchestrating a design review session where Gemini and Codex act as independent UI/UX critics. The goal is to get diverse, high-quality feedback that elevates the design's **taste** (aesthetic refinement, visual hierarchy, attention to detail) and **creative spirit** (unexpected delightful interactions, emotional resonance, memorable moments).

## How This Works

You have a design proposal — it might be a plan file, an HTML mockup, component code, CSS, or a description of an interaction flow. You'll send it to two external AI agents (Gemini CLI and Codex CLI) as independent reviewers, then synthesize their feedback into actionable improvements.

## Step 1: Gather the Design Context

Before calling the reviewers, assemble a clear brief. Read the relevant files and construct a context block that includes:

- **What it is**: The component/page/feature being designed
- **Current state**: What exists now (screenshot description, existing code, or "greenfield")
- **Design direction**: Aesthetic goals, brand language, constraints
- **Specific files**: Paste or summarize the actual code/plan/mockup content
- **What you want reviewed**: Be specific — "Is the toolbar expansion interaction natural?" is better than "Review this design"

Keep the brief under 2000 words. Both CLIs have context limits, and a focused brief gets better feedback than a data dump.

## Step 2: Craft the Review Prompts

Each reviewer gets a slightly different angle to maximize diversity of feedback. Do NOT share your own design conclusions or preferences — let them form independent opinions.

**Gemini** focuses on **interaction design and emotional resonance**:
- Does the interaction flow feel natural and intuitive?
- Are there moments of delight or surprise?
- What's the emotional arc of the user journey?
- Where does the design feel generic vs. distinctive?

**Codex** focuses on **visual craft and technical elegance**:
- Is the visual hierarchy clear and intentional?
- Are the spacing, typography, and color decisions refined?
- Does the implementation approach enable or constrain the design vision?
- What small details would elevate it from "good" to "exceptional"?

## Step 3: Call Both Reviewers in Parallel

Launch both in a single turn for efficiency. Use these exact CLI patterns:

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

Prompt template for each reviewer (adapt the focus area):

```
You are a senior UI/UX designer known for creating interfaces with exceptional taste and creative spirit. You're reviewing a design proposal for [WHAT_IT_IS].

## Context
[PASTE THE DESIGN BRIEF HERE]

## Your Review Focus
[GEMINI: interaction design, emotional resonance, user delight]
[CODEX: visual craft, spatial composition, refined details]

Please provide:
1. **First impression** (2-3 sentences) — What stands out, what's the vibe?
2. **What works well** (3-5 points) — Specific elements that show good taste
3. **What needs elevation** (3-5 points) — Specific areas that feel generic, unrefined, or miss opportunities for delight. For each, suggest a concrete improvement.
4. **One bold idea** — A single unexpected suggestion that could make this design memorable. Think beyond the obvious.

Be specific and reference actual elements from the design. Avoid generic advice like "add more whitespace" — instead say exactly where and why.
```

## Step 4: Synthesize the Feedback

After both reviews come back, create a synthesis that:

1. **Identifies consensus** — Where both reviewers agree, the signal is strong
2. **Highlights unique insights** — Each reviewer's best idea that the other missed
3. **Resolves contradictions** — If they disagree, explain both perspectives and recommend a direction
4. **Prioritizes** — Rank improvements by impact-to-effort ratio
5. **Extracts the "bold ideas"** — Present both reviewers' bold ideas and assess feasibility

Format the synthesis as a clear, scannable summary the user can act on. Lead with the highest-impact changes.

## Step 5: Propose Design Updates

Based on the synthesis, propose specific changes to the design files. For each change:
- Reference which reviewer(s) inspired it
- Explain what it improves (taste, delight, clarity, etc.)
- Give the exact code/CSS/copy change if applicable

Ask the user which improvements they'd like to apply before making any changes.

## Important Notes

- **Independence is key**: Never tell the reviewers what you think the answer should be. The whole point is getting fresh eyes.
- **Context matters**: The more specific your brief, the more specific the feedback. "Review this form" gets generic advice. "This glassmorphism card appears above a 3D starfield canvas at bottom-center; the color swatches feel too flat against the cosmic aesthetic" gets targeted suggestions.
- **Don't over-optimize**: Not every piece of feedback needs to be acted on. The user decides what aligns with their vision.
- **Language**: Write the review prompts in the same language the user is using (Chinese or English).
