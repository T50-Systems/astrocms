# ADR-0002 — Estrategia de renderizado de Astro: estático, SSR o híbrido

- **Estado:** Aceptado
- **Fecha:** 2026-07-10
- **Decisión:** **Híbrido con SSR on-demand por defecto** (adaptador Node), y export estático
  opcional por-proyecto para sitios de alto tráfico. La ruta de preview **siempre** es SSR.

## Contexto

- El **cliente publica sin tocar Git/terminal**: al pulsar "Publicar", el contenido debe verse
  ya, sin un rebuild manual.
- Hay **drafts y preview** que exigen render por-petición con autorización (token de preview).
- El CMS es la **fuente de verdad**; el contenido cambia con frecuencia editorial.
- Se busca buen rendimiento público y seguridad (público nunca ve borradores).

## Opciones

1. **Estático puro (SSG).** Máximo rendimiento y coste mínimo, pero **cada publicación requiere
   un rebuild + redeploy**. Choca con "publicar sin tocar terminal" salvo que se automatice un
   webhook→rebuild, que añade latencia (segundos-minutos) y complejidad de despliegue. El preview
   de drafts no encaja en estático.
2. **SSR on-demand (adaptador Node).** Cada request se renderiza contra la API pública del CMS.
   Publicar es **instantáneo**. Soporta preview autorizado de forma natural. Requiere un proceso
   Node vivo y una **capa de caché** para rendimiento. Encaja con autohospedaje (ya hay Node).
3. **Híbrido.** Elegir por ruta: la mayoría SSR (o estático con revalidación), y forzar SSR donde
   haga falta (preview, rutas dinámicas).

## Decisión

**Híbrido con SSR por defecto:**
- `output: 'server'` con adaptador Node (`@astrojs/node`).
- Páginas públicas: SSR contra `GET /api/v1/public/...`, con **caché HTTP** (Cache-Control +
  posible cache en memoria/Redis opcional) e invalidación por webhook `entry.published`.
- **Ruta de preview `/__builder/preview/:id`: SSR obligatorio**, `prerender = false`, autorizada
  por token; nunca cacheada; renderiza el **draft real**.
- Los assets del tema (CSS/JS del proyecto) se sirven estáticos/CDN normalmente.
- **Escape hatch:** un proyecto de marketing muy estable puede activar export estático +
  webhook→rebuild; el CMS y los contratos no cambian, sólo la config de despliegue de ese Astro.

## Justificación

Publicar-al-instante y preview-de-drafts son requisitos duros del enunciado; ambos se satisfacen
naturalmente con SSR y mal con SSG puro. El coste de SSR (proceso Node + caché) es aceptable
porque el despliegue ya es autohospedado en Node y el volumen es moderado. El híbrido deja la
puerta abierta a estático donde el rendimiento/coste lo justifique, sin acoplar esa decisión al
núcleo.

## Consecuencias

- `apps/astro-demo` usa `@astrojs/node` en modo `standalone` (contenedor en compose).
- Se define una **capa de caché** con interfaz opcional (sin exigir Redis en el MVP: cache
  en-memoria por defecto, driver Redis enchufable después).
- La invalidación se ancla al webhook de publicación (ya existe en el modelo de datos).
- Seguridad: el render público usa **sólo** la API pública (jamás credenciales de admin); el
  preview usa token de vida corta.
