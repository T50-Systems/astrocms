# 08 — Roadmap por hitos

Trabajo por fases; cada fase termina en algo ejecutable y demostrable. Los incrementos son
**verticales** (código + migración + tipos + validación + tests + docs + criterios + demo).

## Fase 0 — Definición ✅ (este entregable)
Arquitectura, ADRs, fronteras de módulos, contratos, modelo de datos, amenazas, estrategia de
testing, convenciones. **Salida:** `docs/*`, ADRs, raíz del monorepo configurada.

## Hito 1 — Núcleo del CMS (Fase 1)
DB (Drizzle + migraciones + seed), auth (sesiones cookie HTTP-only, hashing, CSRF, rate limit),
usuarios, roles `admin`/`editor`, content types base, entries + `entry_versions`, drafts,
revisiones, publicación, API v1 administrativa y pública.
**Demo:** crear/editar/publicar una página vía API (curl/tests); revisiones y restore funcionan.

## Hito 2 — Panel administrativo (Fase 2)
`cms-admin`: login, layout, listados (páginas/entradas), formularios (RHF+Zod), media
(subida + Sharp + variantes + picker), menús, SEO, ajustes. Estados loading/error/empty. A11y.
**Demo:** un editor administra contenido y medios desde `/admin` sin tocar API a mano.

## Hito 3 — Integración Astro (Fase 3)
`cms-sdk`, `cms-astro`, renderer, ruta de preview, manifiesto, tema demo, páginas públicas.
API pública sólo sirve publicado; preview requiere token.
**Demo:** la página publicada se ve en la URL pública renderizada por Astro; el draft, sólo con token.

## Hito 4 — Núcleo del builder (Fase 4)
`builder-core`: modelo de documento, comandos, undo/redo, selección, validación, migraciones;
`builder-sdk` + adaptadores (cms/inMemory/jsonFile). Sin UI todavía.
**Demo:** tests que construyen/mutan/validan/migran documentos y hacen undo/redo determinista.

## Hito 5 — Builder visual (Fase 5)
`builder-react`: canvas con iframe, panel de bloques, árbol, inspector, dnd (dnd-kit), edición
inline, responsive por tokens, media picker. Protocolo iframe tipado.
**Demo:** maquetar una página arrastrando bloques y editando props en vivo, sin persistir aún.

## Hito 6 — Integración completa (Fase 6)
Builder como editor del CMS; guardar draft, revisiones, publish, permisos, preview, manejo de
errores; tests e2e (Playwright) del criterio de éxito.
**Demo:** el flujo completo de 18 pasos del criterio de éxito pasa en e2e.

## Hito 7 — Endurecimiento (Fase 7)
Seguridad (auditoría, revocación de sesiones, validación de uploads, URLs firmadas), performance
(cache, parches incrementales del preview), accesibilidad, migraciones, documentación, instalador,
Docker Compose pulido, ejemplo real, segundo proyecto Astro reusando el núcleo.
**Demo:** criterio de éxito #19 (reutilizar el núcleo en un segundo proyecto con otros componentes).

## Primer incremento vertical (arranca tras Fase 0)
Subconjunto del Hito 1+2+3 suficiente para una demostración temprana:
- autenticación (login/sesión/logout);
- creación de páginas (entry `page`, draft);
- almacenamiento de drafts (`entry_versions`);
- API v1 mínima;
- panel mínimo (login + lista + form de página);
- renderizado básico en Astro de una página publicada;
- pruebas (unit + integración DB + un e2e feliz).

Este incremento es el objeto de la **segunda entrega** (siguiente respuesta), no de Fase 0.
