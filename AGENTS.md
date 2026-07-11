# AGENTS.md

## Convenciones

- Bloques: `src/builder/blocks/<tipo>.ts` con `defineBlock`.
- Componentes Astro de bloques: `src/components/builder/<Nombre>.astro`.
- Content types: `src/content-types/<key>.ts`.
- Config del builder: `src/builder/config.ts`.
- Config CMS: `astrocms.config.ts`.

## CLI

- `astrocms manifest --json`: imprime el `BlockManifest` activo.
- `astrocms validate`: valida manifiesto/bloques demo y sale distinto de 0 si hay errores.
- `astrocms generate block <tipo> --category <cat> [--dir <ruta>]`: crea descriptor `.ts` y componente `.astro` de forma idempotente.
- `astrocms db:migrate`: ejecuta migraciones con `DATABASE_URL`.
- `astrocms db:seed`: crea datos demo idempotentes con `DATABASE_URL`.

## Limites Duros

- No introducir HTML/CSS/JS libre como superficie de edicion por IA.
- La IA solo puede operar con campos, tokens, content types, `BuilderCommand[]` y documentos validados por Zod.
- `apply_document_ops` solo acepta el union `BuilderCommand`; comandos invalidos se rechazan antes de guardar.
- No publicar, cambiar permisos ni tocar configuracion global fuera de herramientas/contratos explicitos.
- No exponer secretos en logs, errores, snapshots ni fixtures.

## Tests Y DB Local

Postgres local esperado:

```powershell
$env:DATABASE_URL="postgres://astrocms:astrocms@127.0.0.1:5434/astrocms"
```

Verificacion principal:

```powershell
pnpm -r typecheck
pnpm --filter @astrocms/cli test
pnpm --filter @astrocms/mcp test
```

Migraciones y seed:

```powershell
pnpm --filter @astrocms/cli exec astrocms db:migrate
pnpm --filter @astrocms/cli exec astrocms db:seed
```
