# 11 — Riesgos técnicos, amenazas y mitigaciones

## 1. Riesgos técnicos

| ID | Riesgo | Impacto | Prob. | Mitigación |
|----|--------|---------|-------|-----------|
| R1 | **Fidelidad del preview**: el iframe re-renderiza vía Astro SSR en cada cambio estructural → latencia. | Alto | Media | Debounce + `host/node-props-updated` para cambios de prop (parche puntual); re-render completo sólo en cambios estructurales; parches incrementales en Fase 7. |
| R2 | **Deriva de esquemas** entre bloques del proyecto y documentos guardados. | Alto | Media | `version` por nodo + migraciones obligatorias; `schema-mismatch` no rompe el resto; test que migra documentos de fixtures. |
| R3 | **Acoplamiento builder→CMS** filtrándose fuera del adaptador. | Alto | Media | Regla de fronteras en CI (`dependency-cruiser`); el builder sólo conoce `BuilderStorageAdapter` + `BlockManifest`. |
| R4 | **Complejidad del monorepo** ralentiza el arranque. | Medio | Media | Incrementos verticales; paquetes creados al implementarse; Turbo cache. |
| R5 | **Divergencia SQLite/Postgres** si se usa SQLite en dev. | Medio | Media | Postgres por defecto en dev vía Docker; SQLite sólo para tests unitarios puros (ADR-0006). |
| R6 | **Rendimiento del árbol grande** en el builder (documentos con muchos nodos). | Medio | Baja | Estructuras inmutables + selección por id; virtualización del árbol si hace falta. |
| R7 | **Manifiesto desincronizado** entre Astro (build) y CMS (runtime). | Medio | Media | Manifiesto servido por el CMS pero generado en build de Astro y publicado al CMS; versionado + hash; validación al cargar el builder. |
| R8 | **Undo/redo inconsistente** con edición colaborativa futura. | Bajo | Baja | MVP mono-editor; comandos serializables preparan un futuro OT/CRDT sin comprometer ahora. |
| R9 | **Bloqueo del cliente** por errores de bloque en producción pública. | Alto | Baja | Renderer tolerante: bloque desconocido/erróneo se omite con placeholder; nunca tira la página entera. |

## 2. Modelo de amenazas (STRIDE resumido)

**Superficies:** API admin, API pública, API preview, canal iframe `postMessage`, uploads,
render de rich text, servido de archivos.

| Amenaza | Vector | Mitigación |
|---------|--------|-----------|
| **Spoofing** | Suplantar sesión / origen del iframe | Cookies HTTP-only + `SameSite`; validación de `origin` y `channelId` en postMessage; token de preview firmado con expiración. |
| **Tampering** | Modificar payloads / documentos | Validación Zod estricta en toda entrada; HMAC en webhooks; versiones inmutables. |
| **Repudiation** | Negar acciones | `audit_log` con actor, antes/después, IP. |
| **Information disclosure** | Ver drafts/otros sitios | API pública sólo publicado; preview con token; `site_id` en queries; sin listar assets ajenos. |
| **Denial of service** | Fuerza bruta / uploads enormes | Rate limit en auth; límites de tamaño/MIME; timeouts; paginación obligatoria. |
| **Elevation of privilege** | Editor haciendo tareas de admin | RBAC por permiso en cada endpoint; sin confiar en el cliente; tests negativos. |

## 3. Controles de seguridad desde el día 1 (checklist)

- [ ] Cookies `HttpOnly; Secure; SameSite=Lax`; sesión revocable en DB.
- [ ] CSRF (double-submit token) en mutaciones de la API admin.
- [ ] Rate limit en `/auth/*`.
- [ ] Hashing de contraseñas con argon2id (o bcrypt cost≥12).
- [ ] Validación de `origin` + `channelId` + `targetOrigin` explícito en el iframe.
- [ ] Uploads: validación de **MIME real** (magic bytes), límite de tamaño, checksum, nombres saneados.
- [ ] Rich text: almacenar JSON de Tiptap; sanear al renderizar (allowlist de nodos/marcas).
- [ ] Prevención de path traversal en `storage` (claves opacas, sin rutas del cliente).
- [ ] URLs firmadas para archivos privados cuando el driver lo requiera.
- [ ] Separación estricta API pública / admin / preview.
- [ ] **No** ejecutar código instalado desde el panel; **no** JS/CSS arbitrario; **no** imports dinámicos no confiables.
- [ ] Sin secretos en el repo; `.env` fuera de control de versiones.

## 4. Riesgos de producto / proceso

- **Sobre-ingeniería temprana** → mitigado por "sin carpetas vacías / sin abstracciones sin uso" y por incrementos verticales.
- **Alcance del builder creciendo** hacia page-builder libre → limitado por tokens/bloques controlados; CSS/JS libres explícitamente fuera del MVP.
- **Actualizaciones del núcleo rompiendo proyectos** → API y documentos versionados; migraciones; contratos estables.
