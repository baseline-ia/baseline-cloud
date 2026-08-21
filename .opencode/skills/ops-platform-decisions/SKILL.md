---
name: ops-platform-decisions
description: "Trigger: ops-platform, decisiones arquitectura, temas diferidos, T1 metamodelo, T2 GraphQL, T5 watch K8s. Decisiones vigentes y temas diferidos de ops-platform antes de proponer cambios grandes."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## Activation Contract

Cargar ANTES de proponer o implementar cambios **grandes** en ops-platform:
cambio de stack, motor de datos, módulos nuevos, nuevas integraciones o
cualquier cosa que toque los temas diferidos listados abajo.

## Hard Rules

### Decisiones vigentes — NO re-discutir sin un disparador real

| Área | Decisión | Implicación |
|------|----------|-------------|
| Persistencia | Postgres + … (ver \`references/decisiones.md\`) | No proponer otra BD sin motivo. |
| API | REST sobre HTTP API + Lambda | **No** GraphQL salvo demanda de integradores. |
| Cómputo | Lambdas (Node 22, arm64) + CloudWatch | **No** NestJS / EKS / Datadog. |
| UI | SVG/CSS propios (tablas, \`DiagramCanvas\`, gráficas) | **Sin** MUI / React Flow / Cytoscape. |

### Temas diferidos — disparar por necesidad, NO por completitud

- **T1** Metamodelo de clases de CI (esquema/validación por tipo) — mayor valor, costo bajo. **Priorizar.**
- **T2** GraphQL — posponer hasta demanda real de integradores.
- **T3** Motor de grafo — posponer hasta que la escala o las queries lo justifiquen.
- **T4** Gestión de cambios (ITIL) — posponer hasta que el proceso lo pida.
- **T5** Watch K8s real-time — posponer hasta integración concreta con clusters.

## Decision Gates

| Si el cambio propuesto… | Acción |
|---|---|
| Contradice una decisión vigente sin disparador | Frenar. Pedir disparador explícito; si no existe, mantener la decisión. |
| Toca un tema diferido (T2–T5) "por completitud" | Frenar. Pedir detonante concreto (escala, integración, proceso). |
| Activa T1 (metamodelo de CI) | Adelante — es el de mayor valor y costo bajo. |
| Es chico y no toca arquitectura | No requiere esta skill; saltar a \`ops-platform-lineamientos\`. |

## Execution Steps

1. Leer \`references/decisiones.md\` completo si la propuesta toca stack, datos o UI pesada.
2. Confirmar que el cambio NO contradice las decisiones vigentes, o que trae un disparador explícito.
3. Si toca un tema diferido, pedir detonante concreto antes de continuar.
4. Solo entonces delegar a \`sdd-explore\` / \`sdd-propose\` con la decisión ya validada.

## Output Contract

Devolver:
- Decisiones vigentes consultadas.
- Temas diferidos revisados.
- Disparador explícito si hay contradicción o tema diferido tocado.
- Próxima fase SDD recomendada (explore / propose / skip).

## References

- \`references/decisiones.md\` — registro completo de decisiones con razones y disparadores.
- \`openspec/DECISIONS.md\` — fuente de verdad en el repo.
