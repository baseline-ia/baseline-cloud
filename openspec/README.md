# OpenSpec

Spec-driven development for this project. Every change starts here, not in code.

## Structure

```
openspec/
├── specs/        # canonical capabilities (the "what is" — source of truth)
│   └── <capability>/
│       └── spec.md
└── changes/      # in-progress changes (the "what's changing")
    └── <change-id>/
        ├── proposal.md   # why and what
        ├── specs/        # delta specs for this change
        │   └── <capability>/
        │       └── spec.md
        ├── design.md     # technical decisions
        └── tasks.md      # implementation checklist
```

## Workflow

1. Pick a `change-id` (kebab-case: `add-auth`, `fix-token-bug`, `migrate-to-pnpm`)
2. Create `openspec/changes/<change-id>/`
3. Write `proposal.md` first — what and why
4. Write `specs/` — requirements with scenarios
5. Write `design.md` — technical approach
6. Write `tasks.md` — implementation checklist
7. Use `/sdd-new` to get AI assistance through the phases
8. When the change is merged, archive it — delta specs move to `openspec/specs/`

## Conventions

- One folder per change — never share folders between changes
- The proposal is required before any code is written
- Scenarios in specs use `#### Scenario: <name>` headers
- Tasks in `tasks.md` are `- [ ]` checkboxes, one per line
- When a task is done, mark it `- [x]` and reference the commit

## Why this matters

When anyone picks up this project — a new dev, an auditor, a future you — they can read `openspec/changes/` and `openspec/specs/` to understand:
- What was decided and why (design.md)
- What the system does (specs/)
- What's currently in progress (changes/)
- What's left to do (tasks.md)

No tribal knowledge. No "ask the lead". The spec is the source of truth.
