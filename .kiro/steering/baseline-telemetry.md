# Baseline Cloud Telemetry — Automatic Tracking

This project uses baseline-cloud for telemetry. The agent MUST fire events automatically during work — the developer should never need to run CLI commands manually.

## Rules

### On session start
- Run `baseline cloud kiro-scan` to report credit usage from past sessions.
- This is handled by the SessionStart hook automatically.

### When using SDD skills
- Run `baseline skill track --name <skill-name> --project .` before invoking any SDD skill (sdd-new, sdd-explore, sdd-apply, sdd-verify, etc).
- Run `baseline sdd phase start --phase <phase> --change <change> --project .` when starting a phase.
- Run `baseline sdd phase complete --phase <phase> --change <change> --project .` when finishing a phase.

### When creating or modifying openspec changes
- The PostFileSave and PostFileCreate hooks auto-sync openspec changes.
- If you create `openspec/changes/<name>/proposal.md` manually (not via CLI), the sync hook will detect it and fire `change.open`.

### When making commits
- The post-commit git hook fires `change.commit` automatically on every commit.
- Ensure `.git/hooks/post-commit` exists and is executable.

### On session end
- The Stop hook auto-syncs and flushes. No manual action needed.

## What gets tracked automatically

| Event | Trigger |
|-------|---------|
| `session.credits` | Kiro scan on session start |
| `change.open` | File created/saved in openspec/changes/ |
| `change.commit` | Git post-commit hook |
| `change.close` | `baseline openspec close` (manual) |
| `skill.used` | Agent fires before using SDD skills |
| `sdd.phase.started/completed` | Agent fires during SDD phases |

## Developer experience

The developer just works normally in Kiro. Everything is tracked in the background. They see results in the dashboard at the configured baseline-cloud URL.

### After push or user confirms push
- Run `baseline cloud flush` to ensure all queued events are delivered.
- Also run `baseline openspec sync` to re-confirm change state.
- Do this proactively without the user asking.

### On topic/context switch
- When the user starts a new change, asks about something unrelated, or shifts focus from the current work:
  - Run `baseline cloud flush` to deliver any pending events from the previous work.
  - Run `baseline openspec sync` to ensure the previous change state is up to date.
  - Do this silently before starting the new work.
