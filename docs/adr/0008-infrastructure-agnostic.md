# ADR-0008 — Infra-agnóstico por puertos y adaptadores

- **Estado:** Aceptado
- **Fecha:** 2026-07-10
- **Decisión:** La plataforma no depende de ningún proveedor de infraestructura concreto. Todo
  recurso de infraestructura se consume a través de un **puerto** (interfaz TS) con al menos un
  **adaptador por defecto de cero dependencias externas**. El único servicio de respaldo
  **obligatorio** es una base de datos **SQL compatible con PostgreSQL**.

## Contexto

Requisito del proyecto: la herramienta debe poder incorporarse en cualquier proyecto Astro futuro
y desplegarse en cualquier sitio (VPS propio, contenedor, PaaS, on-premise), sin atarse a un cloud,
un bucket propietario, un broker de colas ni un APM concreto. A la vez, no queremos sobre-ingeniería:
Postgres sí es una dependencia dura, pero es **vendor-neutral** (protocolo abierto, decenas de
proveedores: auto-hospedado, RDS/Aurora, Cloud SQL, Neon, Supabase, Timescale…).

## Decisión: arquitectura hexagonal (ports & adapters)

Cada dependencia de infraestructura vive detrás de una interfaz en un paquete propio. El dominio
(`cms-core`, `builder-core`) sólo conoce el puerto, nunca el proveedor.

| Puerto (interfaz) | Paquete | Adaptador por defecto (0 infra) | Adaptadores opcionales |
|---|---|---|---|
| `StorageDriver` (archivos) | `storage` | **filesystem** local | S3, R2, MinIO, GCS (S3-compat) |
| `CacheDriver` | `cms-core/cache` | **in-memory** (LRU) | Redis / KeyDB / Valkey |
| `JobQueue` (tareas) | `cms-core/jobs` | **in-process** (async) | BullMQ/Redis, PGBoss (sobre la propia DB) |
| `Mailer` (correo) | `cms-core/mail` | **noop + log** (o SMTP) | SMTP, o proveedor vía plugin |
| `SecretsProvider` | `cms-core/config` | **env vars** (12-factor) | Vault, SSM, Doppler (plugin) |
| `Clock` / `IdGenerator` | `cms-core` | funciones estándar | inyectables en tests |
| `Logger` | `cms-core/log` | **stdout JSON** (pino) | destino/APM enchufable |
| `StorageSigner` (URLs firmadas) | `storage` | firma HMAC local | firma nativa del proveedor S3 |

Reglas:
- **Config por variables de entorno** (12-factor). Nada de rutas/credenciales hardcodeadas; el
  `driver` se elige por env (`STORAGE_DRIVER`, `CACHE_DRIVER`, …).
- **Selección de adaptador en el borde** (composition root de `cms-server`), inyectada al dominio.
  El dominio recibe puertos ya resueltos; no hace `if (provider === 's3')`.
- **Arranque mínimo:** con sólo Postgres + filesystem + in-memory, la plataforma funciona entera.
  Redis, S3, SMTP, etc. son **mejoras**, no requisitos.

## Portabilidad de runtime

- **Backend:** Node ≥20 con APIs estándar; empaquetado como **imagen OCI** → corre en Docker,
  Kubernetes, Nomad, PaaS (Fly, Railway, Render, Coolify) o VPS con systemd. Sin APIs propietarias
  de serverless. El **dominio no conoce HTTP** (ADR-0003), así que el transporte es sustituible.
- **Astro:** adaptador **Node standalone** por defecto (ADR-0002). El proyecto puede cambiar de
  adaptador de despliegue de Astro **sin tocar el CMS ni los contratos** — la integración es por
  API pública + SDK.
- **Base de datos:** SQL estándar vía Drizzle + driver `postgres`. **Se evitan** extensiones y SQL
  específicos de un proveedor; se usan sólo features de Postgres core (JSONB, GIN, `timestamptz`,
  `gen_random_uuid()` de `pgcrypto`, disponible en todos los proveedores). `DATABASE_URL` conecta
  a cualquier Postgres gestionado o propio.

## Qué NO hacemos (evitar sobre-abstracción)

- No abstraemos la base de datos detrás de un puerto genérico "cualquier DB": Postgres es la
  dependencia dura y ya es vendor-neutral. Abstraerla añadiría complejidad sin beneficio real.
- No implementamos todos los adaptadores ya: en el MVP se entregan los **por-defecto** + S3/MinIO
  (para validar el puerto de storage). Redis/BullMQ/Vault llegan cuando un despliegue los pida.

## Consecuencias

- **Portabilidad real:** el mismo artefacto corre en un VPS de 5€ o en Kubernetes gestionado, sin
  cambios de código, sólo de variables de entorno.
- **Testabilidad:** los puertos se sustituyen por fakes in-memory en tests (ya previsto en
  `inMemoryAdapter` del builder y en `Clock`/`IdGenerator`).
- **Verificación:** la regla de fronteras (ADR-0003) se amplía: el dominio no puede importar SDKs
  de proveedores (`@aws-sdk/*`, `ioredis`, …) directamente; sólo los adaptadores lo hacen. Se
  comprueba en CI con `dependency-cruiser`.
- **Coste:** un composition root explícito y disciplina de inyección. Aceptable y ya implícito en
  el diseño de storage.
