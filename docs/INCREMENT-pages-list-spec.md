# Incremento (spec) — Lista de Páginas estilo WordPress

Inspirado en la pantalla "Pages" de WordPress. Se implementa **después** del incremento de
Categorías/Etiquetas para evitar choques en ficheros compartidos (router, cms-server, cms-sdk, contracts).

## Backend

- **Búsqueda por título:** `entries.list` acepta `search?` (ILIKE sobre el título de la versión actual).
- **Contadores por estado:** endpoint o campo que devuelva `{ all, draft, published, archived }` para el
  content type. Opción simple: `GET /api/v1/pages/summary` → conteos; o incluir `counts` en la respuesta de list.
- **Autor:** el `Entry` de contrato añade `authorName` (join a `users.name`). O un resumen `author: { id, name }`.
- **Fecha:** ya existen `createdAt`/`updatedAt`; mostrar "Actualizada/Publicada" + fecha/hora local.
- Mantener paginación y filtro `status` existentes.

## Frontend (apps/cms-admin/src/routes/pages-list.tsx)

Layout tipo WordPress dentro del shell:
- **Cabecera:** "Páginas" + botón "Añadir nueva" + **buscador** (input + submit) alineado a la derecha.
- **Filtros de estado** como enlaces con contador: `Todas (N) · Publicadas (N) · Borradores (N)` que
  cambian el filtro (query param `status`).
- **Tabla** con columnas: `[checkbox] · Título · Autor · Fecha`. El título enlaza a editar; debajo,
  acciones (Editar · Papelera · si es builder, "Editar visual").
- **Acciones en lote:** checkbox por fila + "seleccionar todo"; un select "Acciones en lote"
  (Eliminar) + botón "Aplicar" que borra las seleccionadas (usa `cms.pages.remove`).
- Estados loading/error/empty; accesible (labels, `scope` en th, aria).

## Fuera de alcance (por ahora)
- Filtro por fecha ("All dates"): secundario.
- Jerarquía de páginas (páginas hijas): requiere `parentId` en entries — futuro.
- Columna de comentarios, Screen Options, Help.

## Verificación
- `pnpm -r typecheck`; `pnpm --filter @astrocms/cms-server test` (test de búsqueda + contadores);
  `pnpm --filter @astrocms/cms-admin build`; comprobación en navegador (buscar, filtrar por estado,
  seleccionar y eliminar en lote).
