# 02 — Modelo de datos (PostgreSQL)

Diseñado single-site pero **multisite-ready**: casi todas las tablas de contenido llevan
`site_id` (FK a `sites`) aunque en el MVP exista una sola fila en `sites`. Esto evita una
migración destructiva futura sin implementar multitenancy real ahora
(ver [ADR-0005](adr/0005-single-site-not-multitenant.md)).

Convenciones:
- PK: `id uuid default gen_random_uuid()` (o `text` con ULID si se prefiere ordenable).
- `created_at timestamptz not null default now()`, `updated_at timestamptz`.
- Datos principales en **columnas tipadas**; extensiones controladas en **JSONB** (no patrón `postmeta`).
- Índices únicos por `(site_id, slug, ...)` donde aplica.

## 1. Identidad, auth y permisos

```
sites(id, name, primary_domain, locale_default, settings jsonb, created_at, updated_at)

users(id, site_id, email, password_hash, name, status['active','disabled'],
      created_at, updated_at)
  UNIQUE(site_id, email)

roles(id, site_id, slug['admin','editor',...], name, is_system bool)
  UNIQUE(site_id, slug)

permissions(id, key)               -- p.ej. 'pages.publish', 'media.delete' (catálogo global)
role_permissions(role_id, permission_id)   PK(role_id, permission_id)

user_roles(user_id, role_id)       PK(user_id, role_id)

sessions(id, user_id, token_hash, ip, user_agent, expires_at, revoked_at, created_at)
  INDEX(user_id), INDEX(token_hash)   -- cookie HTTP-only guarda id+secreto; se compara hash
```

RBAC: permisos → roles → usuarios. Permisos son un catálogo estático (`packages/contracts`);
`admin` tiene todos, `editor` un subconjunto (crear/editar/publicar contenido propio, media,
sin gestión de usuarios/ajustes). Ver [10-acceptance-criteria](10-acceptance-criteria.md).

## 2. Tipos de contenido y campos

```
content_types(id, site_id, key, name, kind['page','post','custom'],
              is_system bool, supports jsonb,   -- {seo:true, revisions:true, builder:true}
              created_at, updated_at)
  UNIQUE(site_id, key)

field_definitions(id, content_type_id, key, type, label, config jsonb,
                  required bool, position int, created_at)
  UNIQUE(content_type_id, key)
  -- 'type' ∈ el catálogo de campos (text, richText, media, repeater, ...). 'config' = opciones del campo.
```

`page` y `post` son content types de sistema pre-sembrados. `custom` cubre "custom content types".
El **valor** de los campos vive en `entry_versions.data` (JSONB validado por el esquema derivado
de `field_definitions`), no en tablas por-campo.

## 3. Entradas, versiones, publicación

Separación estricta trabajo / publicado / historial (ver [08-roadmap](08-roadmap.md) §drafts):

```
entries(id, site_id, content_type_id, slug, status['draft','published','archived'],
        editor_type['rich-text','markdown','builder'],
        current_version_id,          -- versión de trabajo (draft)
        published_version_id,        -- versión publicada (nullable)
        author_id, created_at, updated_at)
  UNIQUE(site_id, content_type_id, slug)
  INDEX(site_id, status)

entry_versions(id, entry_id, version_no int, data jsonb,     -- campos estructurados del entry
               title, seo jsonb, builder_document_id,        -- si editor_type='builder'
               created_by, created_at, note)
  UNIQUE(entry_id, version_no)
```

- Editar = escribir una **nueva** `entry_versions` y apuntar `current_version_id` a ella.
- Publicar = fijar `published_version_id = current_version_id` y `status='published'`.
- Restaurar = crear una nueva versión copiando el `data` de una versión histórica → nuevo draft.
- Comparación = diff entre dos `entry_versions.data` (y entre `builder_document_versions`).

"Páginas" y "entradas" son `entries` con distinto `content_type`. No hay tabla `pages` aparte:
el modelo es uniforme y extensible a custom types.

## 4. Taxonomías

```
taxonomies(id, site_id, key, name, hierarchical bool)   UNIQUE(site_id, key)
terms(id, taxonomy_id, parent_id nullable, slug, name, position int)
  UNIQUE(taxonomy_id, slug)
term_relationships(term_id, entry_id)   PK(term_id, entry_id)
```

## 5. Medios

```
media_assets(id, site_id, storage_key, filename, mime, bytes, width, height,
             alt, title, checksum_sha256, folder, created_by, created_at)
  INDEX(site_id, created_at)

media_variants(id, asset_id, kind['thumb','sm','md','lg','webp',...],
               storage_key, width, height, bytes, mime)
  INDEX(asset_id)
```

Originales + variantes generadas por Sharp. `storage_key` es opaco al driver
(`packages/storage`). El builder referencia medios por `assetId` (nunca por URL directa).

## 6. Menús y ajustes

```
menus(id, site_id, location, name)                UNIQUE(site_id, location)
menu_items(id, menu_id, parent_id nullable, position int, label,
           link_type['entry','url','custom'], entry_id nullable, url nullable,
           target nullable, meta jsonb)
  INDEX(menu_id, position)

settings(id, site_id, group, key, value jsonb, updated_at)
  UNIQUE(site_id, group, key)      -- ajustes globales agrupados (site, seo, social, ...)
```

## 7. Documentos del builder

El documento vive en su propia tabla (no dentro del entry) para que el CMS lo trate como un
**recurso opaco versionado** y el builder sea intercambiable por adaptador.

```
builder_documents(id, site_id, entry_id nullable, schema_version int,
                  current_version_id, published_version_id nullable,
                  created_at, updated_at)

builder_document_versions(id, document_id, version_no int,
                          tree jsonb,          -- árbol de nodos (root/children/props)
                          schema_version int, created_by, created_at, note)
  UNIQUE(document_id, version_no)
```

`tree` sigue el contrato `BuilderDocument` de [04-contracts-builder](04-contracts-builder.md).
`schema_version` habilita **migraciones de bloques**: al cargar, si la versión del bloque en el
árbol es menor que la registrada en el manifiesto, se aplican migraciones antes de renderizar/editar.

## 8. Integraciones y auditoría

```
webhooks(id, site_id, event, target_url, secret, active bool, created_at)
  -- event ∈ 'entry.published','entry.unpublished','media.created', ...
webhook_deliveries(id, webhook_id, event, payload jsonb, status_code, error,
                   attempt int, delivered_at)

audit_log(id, site_id, actor_user_id nullable, action, entity_type, entity_id,
          before jsonb, after jsonb, ip, created_at)
  INDEX(site_id, created_at), INDEX(entity_type, entity_id)
```

## 9. Diagrama entidad-relación (resumen)

```
sites 1─┬─* users ─* user_roles *─ roles ─* role_permissions *─ permissions
        ├─* sessions
        ├─* content_types 1─* field_definitions
        ├─* entries 1─* entry_versions ─(0..1)─ builder_documents 1─* builder_document_versions
        │        └─* term_relationships *─ terms *─1 taxonomies
        ├─* media_assets 1─* media_variants
        ├─* menus 1─* menu_items
        ├─* settings
        ├─* webhooks 1─* webhook_deliveries
        └─* audit_log
```

## 10. Decisiones de modelado

- **Sin `postmeta`.** Los campos del entry viven como JSONB validado por esquema, no como filas
  clave/valor. Consultas por campo puntual se resuelven con índices GIN sobre `data` cuando haga falta.
- **Versión inmutable.** `entry_versions` y `builder_document_versions` no se sobrescriben; garantizan
  historial, restauración, comparación y auditoría (requisito del enunciado).
- **`site_id` en todo** → futuro multisite sin migración destructiva; MVP usa una sola fila.
- **JSONB sólo para extensiones controladas** (`settings.value`, `data`, `tree`, `seo`, `config`),
  nunca para datos que se consultan/joinean de forma relacional (usuarios, slugs, estados).
