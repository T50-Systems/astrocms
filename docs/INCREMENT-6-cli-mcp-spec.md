# Incremento 6 (spec) — CLI `astrocms` + servidor MCP (AI-native)

Especificación para la capa **AI-native** ([ADR-0009](adr/0009-ai-native-safe-operations.md),
[12-ai-native](12-ai-native.md)): que un agente de IA pueda operar el CMS/proyecto de forma segura,
por los mismos contratos que un humano.

## Principio (recordatorio)

La IA es **otro cliente de los mismos contratos**. La CLI y el MCP no abren un canal privilegiado:
validan con Zod, respetan RBAC, y nunca aceptan HTML/CSS/JS libre. Toda operación es auditable.

## Parte A — CLI `@astrocms/cli` (`astrocms`)

Comandos idempotentes, con `--json` para consumo por agentes y códigos de salida claros:

| Comando | Efecto |
|---|---|
| `astrocms generate block <tipo> --category <cat>` | Andamia `src/builder/blocks/<tipo>.ts` (defineBlock) + `src/components/builder/<Nombre>.astro` + lo registra en `registry`/config |
| `astrocms add content-type <key> --kind <page\|post\|custom>` | Crea `src/content-types/<key>.ts` |
| `astrocms generate types` | Genera tipos TS desde content types/manifiesto |
| `astrocms manifest --json` | Imprime el `BlockManifest` (para introspección) |
| `astrocms validate` | Valida bloques/config/documentos; sale ≠0 si hay errores |
| `astrocms db:migrate` / `db:seed` | Envuelve los de `cms-database` |

Implementación: paquete `@astrocms/cli` con `bin`, parser de args ligero (sin deps pesadas o
`commander`), salida estructurada. Errores accionables (`code`, `path`, sugerencia). Reutiliza
`@astrocms/schemas` (defineBlock/buildManifest) y `@astrocms/cms-database`.

## Parte B — Servidor MCP `@astrocms/mcp`

Expone el CMS como **herramientas tipadas** (protocolo MCP, vendor-neutral) para agentes:

| Herramienta | Efecto | Seguridad |
|---|---|---|
| `get_manifest`, `list_content_types`, `describe_field_types` | Introspección | lectura |
| `query_entries`, `get_entry`, `list_media` | Lectura estructurada | RBAC lectura |
| `create_page`, `update_entry`, `publish_entry` | Escritura vía casos de uso | RBAC + validación Zod |
| `apply_document_ops` | Aplica `BuilderCommand[]` validados a un documento (via builder-core + adapter) | valida contra manifiesto |
| `validate_document`, `validate_entry` | Verifica antes de guardar | — |
| `register_block` | Andamia+registra un bloque (equivale a la CLI) | — |

- Se autentica con una **API key de servicio** o una sesión; actúa con permisos concretos (no root implícito).
- Cada herramienta valida su entrada con el Zod del contrato correspondiente y devuelve el mismo
  `ApiError` tipado ante fallo → el agente se autocorrige.
- **No ejecuta código arbitrario**; `apply_document_ops` solo acepta comandos del `BuilderCommand` union.

## Parte C — `AGENTS.md` del proyecto

El instalador genera en la raíz del proyecto Astro un `AGENTS.md` (para agentes de código) con:
convenciones de ubicación de bloques/content types, comandos de la CLI, límites duros (nada de
HTML/CSS/JS libre, solo tokens/campos del esquema), y cómo correr tests/migraciones.

## Verificación

- CLI: `astrocms manifest --json` produce JSON válido; `astrocms validate` sale 0 en el demo;
  `astrocms generate block test/foo` crea los ficheros y `pnpm --filter astro-demo typecheck` sigue verde.
- MCP: un test que arranca el servidor MCP en proceso, llama `get_manifest` y `apply_document_ops`
  con un comando válido (aplica) y uno inválido (rechazado con error tipado, sin mutar).
- `pnpm -r typecheck` verde. Ningún archivo >500 LOC.

## Notas

- Es la materialización del segundo requisito duro del usuario ("fácil de operar por IA").
- El MCP reutiliza `cms-sdk` + `builder-core` + `builder-adapters`; no reimplementa dominio.
- Convive con el infra-agnosticismo: el `AiProvider` (asistente del panel para el cliente) es un
  puerto opcional aparte; la CLI/MCP no dependen de ningún proveedor de IA.
