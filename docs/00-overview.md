# 00 — Resumen, supuestos y alcance

> Plataforma: **AstroCMS** (nombre de trabajo). Dos productos conceptualmente separados —
> un **CMS autohospedable para Astro** y un **builder visual WYSIWYG de bloques Astro**—
> integrados por contratos públicos, SDK y adaptadores.

## 1. Resumen del problema

Construyo sitios con Astro y necesito entregar a cada cliente un panel cómodo (`/admin`)
para administrar **páginas, contenido, imágenes, menús y SEO sin tocar código, Git ni terminal**.

No quiero un CMS headless genérico (tipo Strapi). Quiero una plataforma reutilizable que
funcione como el **núcleo de WordPress** para proyectos Astro, con un **builder opcional**
(equivalente a Elementor) para maquetar páginas visualmente con **componentes Astro registrados**.

Analogía rectora:

| Pieza                        | Equivalente WordPress |
|------------------------------|-----------------------|
| CMS                          | Núcleo de WordPress   |
| Builder                      | Elementor             |
| Proyecto Astro               | Tema + frontend público |
| Componentes Astro registrados| Widgets / bloques     |

## 2. Supuestos

- **S1.** Instalación **por cliente** (single-site). Se evitan decisiones que impidan multisite futuro, pero no se implementa multitenancy.
- **S2.** El operador técnico (yo) despliega y configura; el cliente sólo edita contenido.
- **S3.** Node.js ≥ 20 disponible en el entorno de despliegue (VPS, contenedor). No es entorno edge-only.
- **S4.** PostgreSQL como base de producción; SQLite permitido en dev **sólo** si no diverge (ver ADR-0006).
- **S5.** El proyecto Astro y el CMS se despliegan juntos o coordinados; comparten el `contracts`/`schemas`.
- **S6.** El cliente confía en los bloques que yo registro; **no** puede introducir JS/CSS arbitrario.
- **S7.** Volumen moderado: decenas de páginas, miles de assets, pocos editores concurrentes. Sin colaboración en tiempo real.
- **S8.** El builder es **opcional**: el CMS es plenamente funcional sin él (editor rich-text / markdown / campos).

## 3. Alcance (MVP)

**CMS:** instalación, login, sesiones (cookie HTTP-only), usuarios, roles `admin`/`editor`,
páginas, entradas, sistema básico de content types, campos personalizados, rich text (Tiptap),
biblioteca de medios (Sharp + storage abstracto), menús, SEO básico, ajustes globales,
drafts, publicación, revisiones persistentes, preview, API REST v1, webhooks, panel React,
integración con Astro vía SDK.

**Builder:** canvas con iframe del Astro real, panel de bloques, árbol de nodos, inspector,
drag-and-drop, reordenar, duplicar, eliminar, ocultar/mostrar, edición inline de texto,
undo/redo local, preview responsive por tokens, media picker (del CMS), guardar draft,
publicar vía CMS, validación de documento, **10 bloques base** + bloques por proyecto.

**Astro:** renderer recursivo de documentos, ruta de preview (`/__builder/preview/:id`),
registro de bloques, manifiesto serializable, integración CMS, tema demo, proyecto demo funcional.

## 4. No alcance (explícito)

Marketplace, e-commerce, multisite, multitenancy completo, comentarios, colaboración en
tiempo real, instalación de plugins desde el panel, CSS libre, JavaScript personalizado,
animaciones complejas, posicionamiento absoluto, breakpoints personalizados por el cliente,
app móvil, GraphQL, múltiples frameworks de frontend, edición completa de temas en el navegador,
hosting administrado, facturación, analíticas avanzadas.

## 5. Principios de arquitectura (invariantes)

1. **Astro es el renderer** del frontend público. El CMS/builder nunca renderizan HTML final del sitio.
2. **El CMS es la fuente de verdad**: contenido, usuarios, permisos, medios, páginas, revisiones, publicación.
3. **El builder sólo administra la estructura visual del documento** (árbol JSON).
4. **Contenido visual = JSON estructurado**, nunca HTML arbitrario.
5. **Componentes Astro se registran por esquemas declarativos**; el código del componente **no** viaja al panel.
6. El cliente **no** modifica JS/CSS arbitrario; sólo contenido, variantes, orden, visibilidad y props permitidas.
7. **Bloques controlados** por encima de un page-builder totalmente libre.
8. El CMS **funciona sin el builder**; el builder **funciona con otros backends** vía adaptadores.
9. **APIs y documentos versionados**; los bloques soportan **migraciones de esquema**.
10. **Tipado fuerte de extremo a extremo**; contratos compartidos, sin duplicar esquemas front/back.
11. **Infra-agnóstico por puertos y adaptadores.** Todo lo que toca infraestructura (storage, caché,
    cola, correo, secretos, observabilidad) pasa por una interfaz con un adaptador por defecto de
    **cero dependencias externas**. El único servicio de respaldo obligatorio es **una base SQL
    compatible con Postgres** (auto-hospedada o gestionada). Ver [ADR-0008](adr/0008-infrastructure-agnostic.md).
12. **Diseñado para operarse con IA, seguro por construcción.** La herramienta es *legible y
    manipulable por agentes de IA* (convenciones deterministas, esquemas declarativos, manifiestos y
    OpenAPI machine-readable, CLI + codegen + servidor MCP, `AGENTS.md`). Toda IA —de build o de
    edición— actúa por los **mismos contratos tipados, validados y versionados** que un humano;
    **nunca** un camino privilegiado ni JS/CSS/HTML libre. Ver [ADR-0009](adr/0009-ai-native-safe-operations.md)
    y [12-ai-native](12-ai-native.md).

## 6. Fronteras que nunca se cruzan

- El builder **no** implementa: usuarios, login, roles globales, base de datos propia, media propia,
  publicación propia, gestión general de páginas, revisiones persistentes propias. Todo eso lo consume del CMS por SDK.
- El panel/builder **nunca** recibe código de componentes Astro, sólo el **manifiesto** (esquema + metadatos).
- El frontend público **nunca** sirve contenido no publicado sin token de preview autorizado.
