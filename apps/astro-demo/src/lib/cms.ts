import type { Menu } from "@astrocms/contracts";
import { createCmsClient } from "@astrocms/cms-sdk";

/** Cliente del CMS para SSR: usa la API pública (sólo contenido publicado). */
export function getCms() {
  const baseUrl = process.env.CMS_API_URL ?? "http://127.0.0.1:3000/api/v1";
  return createCmsClient({ baseUrl });
}

/** Menú público por ubicación. Tolerante a fallos: null si no existe o el CMS no responde. */
export async function getMenu(location: string): Promise<Menu | null> {
  try {
    return await getCms().public.getMenu(location);
  } catch {
    return null;
  }
}

export interface SiteSettings {
  title: string;
  description: string;
  siteUrl: string;
  language: string;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  logoUrl: string;
  brandColor: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Aplana un documento DTCG a variables CSS: `color.brand` → `--color-brand`. */
export function dtcgToCssVars(obj: unknown, prefix = ""): Record<string, string> {
  if (!obj || typeof obj !== "object") return {};
  const rec = obj as Record<string, unknown>;
  if ("$value" in rec) {
    const value = rec.$value;
    return { [`--${prefix.replace(/\./g, "-")}`]: typeof value === "string" || typeof value === "number" ? String(value) : "" };
  }
  let vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (k.startsWith("$")) continue;
    vars = { ...vars, ...dtcgToCssVars(v, prefix ? `${prefix}.${k}` : k) };
  }
  return vars;
}

/** Tokens de diseño (grupo "design-tokens") como mapa de variables CSS. Tolerante a fallos. */
export async function getDesignTokenVars(): Promise<Record<string, string>> {
  try {
    const group = await getCms().public.getSettings("design-tokens");
    return dtcgToCssVars(group.values);
  } catch {
    return {};
  }
}

/** Ajustes públicos del sitio (grupo "site"). Tolerante a fallos: devuelve valores por defecto. */
export async function getSiteSettings(): Promise<SiteSettings> {
  let values: Record<string, unknown> = {};
  try {
    values = (await getCms().public.getSettings("site")).values;
  } catch {
    // sin ajustes configurados todavía
  }
  return {
    title: str(values.title) || "AstroCMS",
    description: str(values.description),
    siteUrl: str(values.siteUrl),
    language: str(values.language) || "es",
    seoTitle: str(values.seoTitle),
    seoDescription: str(values.seoDescription),
    ogImage: str(values.ogImage),
    logoUrl: str(values.logoUrl),
    brandColor: str(values.brandColor) || "#2271b1",
  };
}
