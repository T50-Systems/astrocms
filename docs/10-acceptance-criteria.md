# 10 — Criterios de aceptación del MVP

## 1. Criterio de éxito del primer release (flujo completo)

Debe ser posible, extremo a extremo, sin tocar Git/terminal/código como cliente:

1. Crear un proyecto Astro de ejemplo. → `apps/astro-demo` arranca.
2. Instalar el CMS. → `docker compose up` + `pnpm db:migrate && pnpm db:seed`.
3. Iniciar sesión en `/admin`. → cookie de sesión HTTP-only emitida.
4. Crear una página. → `entry` (kind page) en estado draft.
5. Seleccionar el editor builder. → `editorType='builder'`, se crea `builder_document`.
6. Insertar un Hero. → nodo `site/hero` en el árbol.
7. Editar su título en el preview. → edición inline → `setProp props.title`.
8. Elegir una imagen de la biblioteca. → `MediaRef { assetId }` en props.
9. Agregar una sección de texto. → nodo de contenido añadido.
10. Reordenar los bloques. → `moveNode` respeta constraints.
11. Guardar un draft. → `PUT /builder/documents/:id` + nueva versión.
12. Ver el preview. → iframe muestra el draft con token.
13. Publicar. → `published_version_id` fijado, webhooks disparados.
14. Abrir la URL pública. → Astro sirve la versión publicada.
15. Ver la página renderizada por Astro. → HTML del árbol, sin `data-builder-*`.
16. Restaurar una revisión anterior. → nueva versión desde histórico.
17. Crear un usuario editor. → rol `editor`.
18. Limitar sus permisos. → editor sin `users.manage`/`settings.write`.
19. Reutilizar el mismo núcleo en un segundo proyecto Astro con componentes distintos. → sólo cambian bloques/tema.

Cada paso tiene un test e2e (`#K3`) que lo cubre.

## 2. Criterios transversales (Definition of Done por incremento)

Un incremento se considera terminado sólo si incluye **todo** lo siguiente:
- Código con **TS estricto**, sin `any` no justificado.
- **Migración** DB reproducible (si toca datos) + seed actualizado.
- **Tipos y validación** compartidos desde `contracts` (sin duplicar Zod front/back).
- **Tests:** unitarios del dominio, integración con DB real (testcontainers/compose), y e2e si toca UI.
- **Estados UI:** loading, error y empty cubiertos; formularios validados; a11y básica (labels, foco, roles).
- **Errores explícitos:** nada de fallos silenciosos; respuestas `ApiError` tipadas.
- **Logs estructurados** y `/healthz` verde.
- **Docs** locales del incremento + **comandos para ejecutar** + **demo** reproducible.
- **Sin secretos** en el repo.

## 3. Criterios de aceptación por capacidad (muestras)

**Auth**
- Login válido → 200 + cookie `Secure; HttpOnly; SameSite=Lax`. Inválido → 401 sin filtrar si el email existe.
- 5 intentos fallidos/min desde una IP → 429 (rate limit).
- Logout → sesión revocada; `/me` posterior → 401.

**Contenido y publicación**
- Publicar no altera el draft de trabajo; `published_version` y `current_version` coexisten.
- La API pública nunca devuelve entries no publicados (test negativo).
- Restaurar la revisión N crea la versión N+1 (no sobrescribe historial).

**Builder**
- Un documento con un bloque en `version` inferior migra al cargar; si no hay ruta → `schema-mismatch`, el resto sigue editable.
- `undo` seguido de `redo` recupera exactamente el estado (property test).
- Constraints: soltar un `Column` fuera de `Columns` se rechaza en el drop.
- Edición inline nunca persiste HTML de `contenteditable`; sólo `{nodeId, path, value}`.

**Seguridad del canal iframe**
- Mensaje con `origin` distinto de `PREVIEW_ORIGIN` → descartado (test).
- Preview sin token válido → 401; token expirado → 401.

**Medios**
- Archivo con extensión de imagen pero MIME real distinto → rechazado.
- Se generan variantes Sharp declaradas; el original conserva checksum.
