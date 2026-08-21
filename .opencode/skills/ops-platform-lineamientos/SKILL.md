---
name: ops-platform-lineamientos
description: "Trigger: ops-platform, lineamientos, convenciones, i18n, catálogos BD, Combo, idempotencia, UAT, manual Wedjat, sitio Wedjat. Convenciones obligatorias de ops-platform antes de implementar o modificar."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## Activation Contract

Cargar **siempre** antes de implementar o modificar **cualquier cosa** en
ops-platform. Si algo nuevo no encaja en los lineamientos: primero actualizar
\`references/lineamientos.md\` y luego implementar.

## Hard Rules (top runtime — el detalle está en \`references/\`)

### Idioma e i18n
- UI / docs / textos al usuario en **español** (default). App bilingüe es/en con cookie \`OPSPLATFORM_LOCALE\`.
- Código, identificadores, endpoints y columnas en **inglés**.
- **PROHIBIDO hardcodear texto de UI** (placeholders, labels, toasts, modals, enums visibles). Todo va por i18n (\`useTranslations\`/\`getTranslations\`) con llave en \`messages/es.json\` **y** \`messages/en.json\`.
- **Verificación obligatoria** antes de cerrar un cambio de UI: \`node web/scripts/check-i18n.mjs\` debe imprimir OK.
- Excepción única: prosa legal de \`app/privacy\` y \`app/cookies\` (no autotraducir).

### UI — combos y catálogos
- Todo select de **entidad** (componente, ambiente, tipo, usuario, etc.) DEBE ser \`Combo\` (\`@/components/Combo\`), nunca \`<select>\` nativo.
- Solo enums fijos y cortos (status, criticidad, periodicidad, doc_type, kind) admiten \`<select>\`.
- **Cascade obligatorio** entre combos dependientes: las opciones del hijo se filtran por la selección del padre; al cambiar el padre se limpian las selecciones del hijo que ya no apliquen.
- Mostrar la **etiqueta legible** (nombre/path), nunca el id crudo (p. ej. el path del compartimento OCI, no el OCID).
- Todo control de formulario con su \`<label>\`.

### Catálogos
- **Prohibido hardcodear opciones de catálogo** en front o backend. Toda lista de valores que el usuario elige viene de una tabla y se carga por API.
- Globales (nubes, regiones, taxonomía base) sin \`tenant_id\`; por tenant con \`tenant_id = :t\`; si el catálogo puede ser ambos, traer \`tenant_id = :t OR tenant_id IS NULL\` y el de tenant gana.
- Exponer por \`GET /catalogs/{name}\` (registrados en \`CATALOGS\` de \`api/routes/config.ts\`).
- Todo catálogo lleva \`name_i18n JSON\` con \`{"es":"…","en":"…"}\`; el \`GET /catalogs/{name}\` resuelve \`name\` al idioma pedido (header \`x-ops-locale\` o \`?locale=\`). El front propaga el idioma vía proxy BFF + \`apiGet\`.
- En Configuración, el editor captura **Nombre (ES)** y **Nombre (EN)** y envía \`nameI18n\`. Nunca hardcodear ni siquiera el i18n de etiquetas.

### Backend (Lambdas TypeScript, MySQL)
- Rutas en \`backend/src/api/routes/*.ts\`, registradas en \`api/handler.ts\`. Dominio central en \`domain.ts\`.
- En cada handler: \`const p = await resolvePrincipal(ctx.event); requireRole(p, …);\`.
- Aislamiento por tenant: todo query filtra por \`tenant_id = :t\`.
- Paginación a nivel BD: \`pageReq\`, \`orderBy\` (lista blanca) y \`limitOffset\`; devuelve \`{ items, total, page, pageSize }\`.
- Toda mutación llama a \`audit({ tenantId, actor, action, entityType, entityId })\`.
- Soft-delete con \`deleted_at\`; filtrar \`deleted_at IS NULL\`.
- **Idempotencia / anti-duplicados OBLIGATORIA** en operaciones costosas o con efectos secundarios.

### Dependencias / npm
- **Todas** del registro público \`https://registry.npmjs.org\`. **Nunca** del Nexus \`nexus.engen.com.mx\`.

### Migraciones SQL
- Una por versión \`Vn__descripcion.sql\`, **idempotente**.
- **No** usar \`ON UPDATE (UTC_TIMESTAMP())\`.

### OpenSpec
- \`openspec/specs/<capability>/spec.md\` = verdad actual; \`openspec/changes/<id>/\` = propuesta.

### Verificación obligatoria
- Backend: \`npm run typecheck\` y \`npm test\` (110 tests deben pasar).
- Web: \`npx tsc --noEmit\` + \`get_diagnostics\` en archivos tocados.
- i18n: \`node web/scripts/check-i18n.mjs\`.

### UAT (end-to-end) — OBLIGATORIO
- Pruebas en \`uat/\`. Cada cambio de endpoint/módulo/flujo DEBE añadir o ajustar su prueba UAT.

### Manual de usuario (branding Wedjat) — OBLIGATORIO
- Vive en \`docs/manual/\` (Markdown, **español**, branding Wedjat).
- Cada cambio de UI DEBE actualizar el capítulo correspondiente.

### Sitio público / marketing (Wedjat) — OBLIGATORIO
- Vive en \`site/\` (HTML/CSS/JS estático propio, **sin build ni dependencias**).
- Cada cambio de funcionalidad DEBE reflejarse en el sitio.

## Decision Gates

| Si el cambio… | Acción |
|---|---|
| Introduce librería de UI (MUI, React Flow, Cytoscape, etc.) | Frenar. |
| Hardcodea texto de UI o de catálogo | Frenar. |
| Usa \`<select>\` nativo para elegir una entidad | Frenar. Cambiar a \`Combo\`. |
| Toca un endpoint sin actualizar \`uat/tests/\` | Cambio incompleto. |
| Cambia UI sin actualizar \`docs/manual/\` ni \`site/\` | Cambio incompleto. |
| Omite \`acquireOpLock\` en POST caro | Frenar. |

## Execution Steps

1. Leer \`references/lineamientos.md\` completo antes de empezar a codear.
2. Cargar \`ops-platform-decisions\` si la propuesta toca stack/datos/UI pesada.
3. Cumplir cada Hard Rule.
4. Correr las verificaciones obligatorias (typecheck, tests, i18n, UAT).

## Output Contract

Devolver:
- Hard Rules consultadas y aplicadas.
- Decisiones vigentes verificadas.
- UAT, manual y sitio impactados (sí/no + qué cambió).
- Verificaciones corridas y resultado.

## References

- \`references/lineamientos.md\` — documento completo de lineamientos de ops-platform.
- \`ops-platform-decisions\` — skill hermana para decisiones de arquitectura y temas diferidos.
