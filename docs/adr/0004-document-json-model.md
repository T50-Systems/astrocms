# ADR-0004 — Contenido visual como árbol JSON versionado (no HTML)

- **Estado:** Aceptado
- **Fecha:** 2026-07-10
- **Decisión:** El builder guarda un **árbol JSON de nodos** (`BuilderDocument`), nunca HTML.
  Cada nodo lleva `version` de esquema del bloque; el documento lleva `schemaVersion`.

## Contexto

Requisito duro: "contenido visual como JSON estructurado, nunca HTML arbitrario", con soporte de
migraciones de bloques, comparación de revisiones, clonado y validación. El cliente no debe poder
inyectar JS/CSS/HTML libre.

## Decisión

- Documento = `{ id, schemaVersion, root, meta }`; `root` es un `BuilderNode` recursivo
  (`id`, `type`, `version`, `props`, `children`, `hidden?`, `locked?`).
- Las props **no** contienen HTML ni estilos libres: usan campos tipados del sistema de campos
  (tokens semánticos, `MediaRef`, `EntityRef`, JSON de Tiptap saneado).
- **Astro** es quien convierte el árbol en HTML mediante los componentes registrados.
- Migraciones por bloque (`from → to`) se aplican al cargar si el nodo está desactualizado.

## Alternativas descartadas

- **HTML/`contenteditable` persistido:** imposible de validar, migrar, versionar o proteger de XSS.
- **Markdown para todo:** insuficiente para layout/props de bloques ricos.

## Consecuencias

- Validación (`ValidationResult`), diff de revisiones y clonado operan sobre datos estructurados.
- La edición inline se traduce a `setProp {nodeId, path, value}` — el JSON sigue siendo la verdad.
- Cambiar el render de un bloque (mismo esquema) no obliga a migrar documentos.
- Añade la responsabilidad de mantener migraciones al evolucionar un bloque (aceptado).
