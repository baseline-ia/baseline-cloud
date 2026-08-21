---
name: architecture-guidelines
description: "Trigger: architecture, new file, folder structure, layer, where to put, backend, frontend, state management. Guide file placement and validate code against the team's official architecture guidelines."
license: Apache-2.0
metadata:
  author: "baseline-ia"
  version: "1.0"
---

## Activation Contract

Load when:
- Proposing where to create or move a file
- Writing new code that must fit the existing architecture
- Validating that proposed or existing code follows team standards
- Answering questions about layer responsibility or state management

## Hard Rules

These violations block CI/CD automatically — never allow them:

1. **No hardcoded env vars.** All config via `process.env`; secrets via AWS Parameter Store or Secrets Manager.
2. **No empty catch blocks.** Every exception must be caught, parsed, and handled. Use NestJS global exception filters.
3. **No `console.log` in production code.** Use Winston or the NestJS built-in logger. Never log PII, passwords, or tokens.
4. **Every DB query must filter by `tenant_id`.** No query reaches the DB without explicit tenant isolation. Use a TypeORM Subscriber, global scope, or middleware — never rely on call-site filtering.
5. **No raw SQL** (`queryRunner.query()`) without explicit architecture approval. Raw SQL bypasses tenant filtering.
6. **No direct `fetch` or `axios` in React `useEffect`.** All server state goes through React Query.
7. **Controllers do not access the DB or contain business logic.** Services do not know about HTTP.

## Decision Gates

**Backend: NestJS or Lambda?**

| Use case | Choice |
|----------|--------|
| Business flow, CRUD, client-facing API | NestJS |
| SQS consumer, S3 event, EventBridge cron | Pure Lambda (minimal deps) |

**Where does this backend file go?**

| Responsibility | Layer |
|----------------|-------|
| HTTP routing, DTO validation | `controllers/` |
| Business logic, use case orchestration | `services/` |
| Domain entity, pure business rule | `domain/` |
| TypeORM repo, HTTP client, AWS SDK | `infrastructure/` |
| Shared helper, utility function | `utils/` |

**Frontend: React Query or Zustand?**

| State type | Tool |
|------------|------|
| Server data, mutations, cache, retries | React Query |
| Modal open/close, user session, theme, multi-step form | Zustand |

## Execution Steps

1. Identify what the code does: backend logic, lambda handler, domain rule, infrastructure adapter, or frontend state.
2. Map to the correct layer or tool using the decision tables above.
3. Propose the exact file path: `src/{domain}/{layer}/{Name}.ts`.
4. Check proposed code against all 7 hard rules. Flag every violation.
5. If placement is ambiguous, ask one clarifying question before deciding.

## Output Contract

- **Placement**: exact path + one-line justification citing the rule or layer.
- **Validation**: PASS, or a list of violations each with: file, line/pattern, and the hard rule number it breaks.

## References

- `references/official-guidelines.md` — full official architecture document with rationale and examples.
