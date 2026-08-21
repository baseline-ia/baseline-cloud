---
name: conflict-resolver
description: "Trigger: resolver conflictos, merge conflicts, conflict resolution, conflictos de git. Analyze and resolve git merge conflicts using deep reasoning."
license: Apache-2.0
metadata:
  author: amsintegra
  version: "1.0"
---

## Activation Contract

Load this skill when the user asks to resolve merge conflicts, analyze conflicting code, or fix git conflict markers. Scope: current file, specific files, or the entire working tree.

## Model Selection

Before starting, select the most capable reasoning model available. Use this exact priority order for Kiro:

| Priority | Model | Use when |
|----------|-------|----------|
| 1 | **Claude Opus 5** or **GPT 5.6 Sol** | Top tier — deepest reasoning, prefer whichever is available |
| 2 | Claude Opus 4.8 / 4.7 / 4.6 / 4.5 | No top-tier model available |
| 3 | Claude Sonnet 5 | No Opus variant available |
| ❌ | Auto, GPT 5.6 Terra/Luna, Haiku, DeepSeek, MiniMax, GLM, Qwen | Never — insufficient reasoning depth |

If the platform supports model switching, announce the selected model and switch:
> "Switching to [model] for deeper conflict analysis."

If model switching is not available, enable maximum reasoning depth (extended thinking if supported), or proceed with explicit chain-of-thought analysis — reason step by step before producing output.

## Hard Rules

- Never auto-accept either side blindly — always read and understand BOTH sides.
- Never discard code without explaining why it is safe to do so.
- If a conflict is ambiguous (both sides have valid logic), ask the user before resolving.
- Always show a diff-style preview of the resolution before writing to disk.
- If the conflict involves a lock file (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`), resolve by regenerating: instruct the user to delete the file and run the install command — do not attempt manual merge.

## Execution Steps

### Step 1 — Discover Conflicts

```bash
git diff --name-only --diff-filter=U
```

List all files with conflict markers. If the user specified a file, limit scope to that file. Report the count: "Found N conflict(s) in M file(s)."

### Step 2 — Gather Context

For each conflicted file:

1. Read the full file to understand surrounding code structure.
2. Extract each conflict block:
   ```
   <<<<<<< HEAD (current branch)
   [ours]
   =======
   [theirs]
   >>>>>>> branch-name (incoming)
   ```
3. Run `git log --oneline -10 -- <file>` to understand recent history.
4. Run `git log --oneline HEAD...MERGE_HEAD -- <file>` (if available) to see what each branch changed and why.

### Step 3 — Deep Analysis

For each conflict block, reason through:

| Question | Answer |
|----------|--------|
| What is the intent of **ours**? | |
| What is the intent of **theirs**? | |
| Are both changes compatible? | |
| Which takes precedence? Why? | |
| Is there a merge that preserves both intents? | |

Use explicit chain-of-thought reasoning. Do not guess — read the code.

Classify each conflict:

- **AUTO**: Safe to merge automatically, both intents are compatible.
- **PREFER-OURS**: Current branch logic is correct; incoming adds no value or is superseded.
- **PREFER-THEIRS**: Incoming change is the intended update; current branch is stale.
- **MERGE**: Both sides contribute; produce a combined resolution.
- **AMBIGUOUS**: Cannot determine intent; requires user decision.

### Step 4 — Preview Resolution

Before writing, show the resolution for each conflict:

```
── conflict-resolver: FILE ──────────────────────────
File: src/foo/bar.ts  [MERGE]

  Reason: current branch added validation logic; incoming branch
  refactored the same function. Resolution keeps the refactored
  structure and re-applies the validation.

  Resolution:
  ┌─────────────────────────────────────────────────┐
  │  function processOrder(order: Order): Result {  │
  │    validateOrder(order)                         │
  │    return applyDiscount(order)                  │
  │  }                                              │
  └─────────────────────────────────────────────────┘
```

For AMBIGUOUS conflicts, present both sides and ask:
> "I can't determine which to keep. Which do you prefer — [ours / theirs / custom]?"

### Step 5 — Apply Resolutions

After user confirmation (or immediately for AUTO):

1. Write the resolved content to each file, removing all conflict markers.
2. Stage the resolved files: `git add <files>`.
3. Verify no conflict markers remain: `grep -rn "<<<<<<< " <files>` — must return empty.

### Step 6 — Report

```
── conflict-resolver: Summary ───────────────────────
Resolved: N conflicts across M files
  ✅ AUTO    — X (merged automatically)
  ✅ OURS    — X (kept current branch)
  ✅ THEIRS  — X (accepted incoming)
  ✅ MERGED  — X (combined both sides)
  ⚠️ SKIPPED — X (user decision pending)

Model used: [model name]
Reasoning: [standard | extended thinking]

Next: run your test suite to verify the merge is correct.
```

## Decision Gates

| Condition | Action |
|-----------|--------|
| No conflicts found | Report "working tree is clean" and stop. |
| Lock file conflict | Instruct regeneration, do not attempt manual merge. |
| AMBIGUOUS conflict | Ask the user; do not assume. |
| Resolution removes significant logic | Warn explicitly before applying. |
| More than 10 conflicts | Process file by file, ask to continue between files. |
| Tests available | After resolution, suggest running `npm test` / `pnpm test`. |

## Output Contract

Return `## Conflict Resolution — {scope}` with: model used, reasoning mode, conflict table (file / count / classification / resolution), any user decisions pending, and next steps.
