# 12 — Experiencia AI-native y facilidad de uso

Tres audiencias, una sola regla de seguridad ([ADR-0009](adr/0009-ai-native-safe-operations.md)):
la IA es **otro cliente de los mismos contratos** —tipados, validados, versionados—; nunca un
canal privilegiado ni JS/CSS/HTML libre.

```
Dev + IA (build-time)      Cliente + IA (runtime)        Cliente sin IA
  edita el CÓDIGO             edita el CONTENIDO            edita el CONTENIDO
  CLI · codegen · MCP         asistente del panel          panel guiado
  AGENTS.md · manifiesto      → comandos validados         plantillas · patrones
        │                            │                            │
        └──────────── mismos contratos + Zod + RBAC ──────────────┘
```

## 1. Dev + IA — construir el sitio con un agente de código

Objetivo: que un agente (Claude Code u otro) pueda incorporar el CMS a un proyecto Astro y
registrar contenido/bloques **sin adivinar**, con retroalimentación inmediata.

### 1.1 Convenciones deterministas
Ubicaciones y formas fijas (el agente sabe dónde escribir):
```
src/builder/blocks/<tipo>.ts        # defineBlock (esquema declarativo)
src/builder/config.ts               # defineBuilderConfig (lista de bloques)
src/content-types/<key>.ts          # defineContentType
src/components/builder/<Nombre>.astro  # componente que renderiza el bloque
astrocms.config.ts                  # defineCmsConfig (editores, plugins, tema)
```

### 1.2 Esquemas declarativos → todo derivado
Una definición produce tipos TS, Zod, formulario del inspector, defaults y docs. El agente escribe
poco y de forma predecible; el compilador y Zod lo corrigen. (Ver [06-block-registry](06-block-registry.md).)

### 1.3 CLI `astrocms` (idempotente, scriptable, salida JSON)
```
astrocms generate block <tipo> --category Marketing   # andamia .ts + .astro + registra
astrocms add content-type <key> --kind custom
astrocms generate types                               # tipos desde content types/manifiesto
astrocms validate                                     # valida bloques, config y documentos
astrocms db:migrate | db:seed
astrocms manifest --json                              # imprime el BlockManifest
```
Cada comando: exit code claro, `--json` para consumo por IA, y mensajes de error accionables
(`code`, `path`, sugerencia). Un agente puede encadenarlos y reaccionar al resultado.

### 1.4 Servidor MCP (`@astrocms/mcp`)
Expone el CMS/proyecto como **herramientas tipadas** para agentes (protocolo abierto, vendor-neutral):

| Herramienta MCP | Efecto |
|---|---|
| `get_manifest` / `list_content_types` / `describe_field_types` | Introspección: la IA descubre el sistema |
| `register_block` | Andamia y registra un bloque (equivale a la CLI) |
| `create_page` / `update_entry` | Crea/edita contenido vía contratos (RBAC) |
| `apply_document_ops` | Aplica `BuilderCommand[]` validados a un documento |
| `validate_document` / `validate_entry` | Verifica antes de guardar |
| `query_entries` / `list_media` | Lectura estructurada |

El MCP **no** ejecuta código arbitrario: cada herramienta valida contra Zod/manifiesto y respeta
permisos. Es la vía "nativa" para que una IA opere la plataforma con seguridad.

### 1.5 Contratos auto-descriptivos
- **OpenAPI** generado desde Zod (`/api/v1/openapi.json`).
- **BlockManifest** serializable (`/api/v1/builder/manifest`).
- **JSON Schemas** exportables de documento, entry y campos.
Un agente puede leer el sistema entero sin documentación humana.

### 1.6 `AGENTS.md`
El instalador genera en la raíz del proyecto un `AGENTS.md` con: convenciones de ubicación,
comandos de la CLI, qué está permitido/prohibido (nada de HTML/CSS/JS libre, sólo tokens),
cómo registrar un bloque, cómo correr tests/migraciones. Escrito para que un agente lo siga literalmente.

## 2. Cliente + IA — asistente del panel (opcional)

Plugin opcional (`aiAssistantPlugin()`); el CMS funciona sin él. Proveedor detrás del puerto
`AiProvider` ([ADR-0008](adr/0008-infrastructure-agnostic.md)) → el operador elige modelo o lo desactiva.

- **Construir/editar por lenguaje natural:** "añade un hero con este título y esta imagen" →
  el asistente propone `BuilderCommand[]`; el usuario **ve el preview y confirma**; se aplica con
  undo disponible. Las operaciones se validan contra el manifiesto: sólo bloques y props permitidos.
- **Ayudas acotadas de contenido:** generar/mejorar texto de campos `text`/`richText`, sugerir
  `SeoMeta` (title/description), generar `alt` de imágenes, proponer un slug. Siempre sobre campos
  del esquema; nunca inventa props ni tokens fuera de catálogo.
- **Límites duros:** no publica sin confirmación, no cambia permisos/usuarios, no toca ajustes
  globales salvo permiso explícito, no introduce estilos/código libres.

```ts
// forma conceptual del puerto (agnóstico de proveedor)
interface AiProvider {
  suggestDocumentOps(input: { prompt: string; manifest: BlockManifest; document: BuilderDocument })
    : Promise<{ ops: BuilderCommand[]; explanation: string }>;
  improveText(input: { field: "text" | "richText"; value: string; intent: string }): Promise<string>;
  suggestSeo(input: { title: string; body: string }): Promise<SeoMeta>;
  altText(input: { assetId: ID }): Promise<string>;
}
```

## 3. Cliente sin IA — que sea fácil igualmente

La simplicidad **no** depende de la IA (que es una comodidad encima):

- **Plantillas de página** y **patrones reutilizables** → nunca se empieza en blanco.
- **Defaults sensatos** en cada bloque; el inspector sólo muestra props permitidas, con controles
  semánticos (tokens, no números crudos).
- **Preview en vivo**, edición inline, **undo/redo**, revisiones y **publicar con confirmación**.
- **Copy sin jerga**, estados vacíos con guía ("aún no hay páginas — crea la primera"), errores
  en lenguaje llano.
- **Accesibilidad** del panel (labels, foco, roles) como requisito, no opcional.

## 4. Cómo se conecta con lo ya diseñado

- El **modelo de comandos + documento JSON + manifiesto** (ADR-0004) es, además del motor de
  undo/redo, el **API seguro para la IA**: por eso una IA puede editar sin riesgo.
- **RBAC** aplica igual a IA y humanos: el asistente actúa con la sesión de un usuario y sus permisos.
- **Infra-agnóstico** (ADR-0008): el `AiProvider` es un puerto opcional; sin proveedor, el sistema
  entero sigue funcionando.
- **Versionado y migraciones:** la IA opera sobre contratos versionados; sus cambios entran en
  revisiones y son reversibles como cualquier otro.
