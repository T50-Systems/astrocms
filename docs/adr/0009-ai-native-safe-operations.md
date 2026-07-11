# ADR-0009 — Operabilidad por IA, segura por construcción

- **Estado:** Aceptado
- **Fecha:** 2026-07-10
- **Decisión:** La plataforma está diseñada para ser operada tanto por personas como por agentes de
  IA. **Toda** acción de IA —construir el sitio (dev) o editar contenido (cliente)— pasa por los
  **mismos contratos tipados, validados y versionados** que un humano. La IA **no** tiene un canal
  privilegiado ni puede introducir JS/CSS/HTML libre.

## Contexto

Dos usos de IA, con la misma regla de seguridad:

1. **Dev + IA (build-time):** yo construyo el sitio Astro con ayuda de un agente de código (p.ej.
   Claude Code). El agente debe poder registrar content types y bloques, andamiar componentes,
   introspeccionar el sistema y no equivocarse por convenciones ambiguas.
2. **Cliente + IA (runtime):** un asistente opcional dentro de `/admin` ayuda a un cliente no
   técnico ("añade un hero con este texto", "mejora el SEO", "genera el alt de esta imagen").

El riesgo: que la IA se convierta en una vía para inyectar contenido inseguro o inconsistente.
La mitigación ya existe en el diseño: **documento JSON + comandos + manifiesto + Zod**. Este ADR la
declara como principio y define las superficies.

## Decisión

### Principio único
La IA es **otro cliente de los mismos contratos**. Produce:
- `BuilderCommand` / `setProp {nodeId, path, value}` validados contra el `BlockManifest`
  (constraints de padres/hijos, tipos de campo Zod, tokens permitidos), **nunca** HTML.
- `CreateEntryRequest` / `UpdateEntryRequest` validados por el content type.
- Operaciones que respetan **RBAC** (la IA actúa con la sesión/permiso de un usuario real).
Toda salida inválida se rechaza igual que la de un humano; la IA recibe el error tipado y reintenta.

### Superficie para Dev + IA (legibilidad y control del código)
- **Convenciones deterministas:** ubicación y forma fijas de bloques (`src/builder/blocks/*.ts`),
  content types y config, para que un agente sepa dónde escribir sin adivinar.
- **Esquemas declarativos** (`defineBlock`, `defineContentType`): una sola definición → tipos, Zod,
  formulario, defaults, docs (ver [06-block-registry](../06-block-registry.md)).
- **CLI + codegen** (`astrocms`): `generate block`, `add content-type`, `generate types`,
  `db:migrate`, `validate` — comandos idempotentes y scriptables que un agente invoca con salida
  estructurada (JSON) y códigos de salida claros.
- **Servidor MCP** (`@astrocms/mcp`): expone herramientas tipadas de introspección y operación
  (`get_manifest`, `list_content_types`, `register_block`, `create_page`, `apply_document_ops`,
  `query_entries`, `validate_document`) para que un agente opere el CMS/proyecto de forma nativa.
- **Contratos machine-readable:** OpenAPI generado desde Zod, `BlockManifest` serializable, y JSON
  Schemas exportables → el sistema es **auto-descriptivo**.
- **`AGENTS.md`** en la raíz del proyecto generado: reglas, convenciones, comandos y límites,
  escrito para que un agente los siga.
- **Errores accionables:** mensajes con `code`, `path` y sugerencia → la IA se autocorrige.

### Superficie para Cliente + IA (asistente del panel, opcional)
- Es un **plugin** opcional (`aiAssistantPlugin()`), desactivable. El CMS funciona sin él.
- Traduce lenguaje natural a **operaciones de documento validadas** (mismos comandos del builder);
  el usuario **previsualiza y confirma** antes de aplicar/publicar. Undo disponible.
- Ayudas de contenido acotadas: generar/mejorar textos de campos `text`/`richText`, sugerir
  `SeoMeta`, generar `alt` de imágenes. Nunca crea props fuera del esquema ni tokens no permitidos.
- **Proveedor de IA agnóstico:** detrás de un puerto `AiProvider` (ver [ADR-0008](0008-infrastructure-agnostic.md));
  el cliente elige modelo/proveedor o lo desactiva. Sin proveedor cableado.

### Cliente no técnico (sin IA)
La facilidad no depende de la IA: plantillas de página, patrones reutilizables, defaults sensatos,
copy sin jerga, preview en vivo, publicación con confirmación y undo/revisiones. La IA es una
comodidad **encima** de un panel que ya es simple.

## Consecuencias

- El modelo de comandos/documento no era sólo para undo/redo: es el **API seguro para la IA**.
  Refuerza la decisión de [ADR-0004](0004-document-json-model.md).
- Nuevo paquete `@astrocms/mcp` y una CLI `astrocms` entran al roadmap (Hito 3–7, no bloquean el MVP core).
- El asistente del panel y el `AiProvider` son opcionales y agnósticos → no comprometen el
  infra-agnosticismo ni el criterio "el CMS funciona sin extras".
- Se añade a la estrategia de pruebas: un agente/IA que emite operaciones inválidas debe ser
  rechazado exactamente como un cliente humano (tests de contrato).
