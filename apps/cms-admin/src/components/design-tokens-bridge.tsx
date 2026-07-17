import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { cms } from "../lib.ts";
import { parseHexColor, pickReadableForeground } from "../lib/contrast.ts";

/**
 * Puente Tokens DTCG → tema del panel.
 *
 * Lee el grupo de settings "design-tokens" (la MISMA queryKey que usa la
 * pantalla /tokens, así que al guardar allí este puente se refresca solo)
 * y sobreescribe variables del tema shadcn en :root con estilos inline.
 *
 * Nota: no convertimos hex→oklch — los estilos inline en documentElement
 * ganan a :root/.dark por cascada, y las variables se consumen como
 * var(--primary) en contextos de color donde un hex crudo es válido.
 * Para color.brand hex, el foreground claro u oscuro se elige por mayor
 * contraste. Otros formatos se dejan al tema por defecto porque no se calculan.
 */
const BRIDGE: Array<{ path: string; cssVars: string[] }> = [
  { path: "color.brand", cssVars: ["--primary", "--sidebar-primary", "--ring"] },
];
const BRAND_FOREGROUND_VARS = ["--primary-foreground", "--sidebar-primary-foreground"];

/** Navega un documento DTCG por ruta "a.b.c" y devuelve $value si es string no vacía. */
function readDtcgValue(values: unknown, path: string): string | undefined {
  let node: unknown = values;
  for (const part of path.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  if (!node || typeof node !== "object") return undefined;
  const value = (node as Record<string, unknown>).$value;
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function DesignTokensBridge() {
  const tokens = useQuery({
    queryKey: ["settings", "design-tokens"],
    queryFn: () => cms.settings.get("design-tokens"),
  });

  useEffect(() => {
    const root = document.documentElement;
    for (const { path, cssVars } of BRIDGE) {
      const value = readDtcgValue(tokens.data?.values, path);
      for (const v of cssVars) {
        if (value) root.style.setProperty(v, value);
        else root.style.removeProperty(v); // sin token → tema por defecto
      }

      if (path === "color.brand") {
        const brandRgb = value && parseHexColor(value);
        if (brandRgb) {
          const fg = pickReadableForeground(brandRgb);
          for (const v of BRAND_FOREGROUND_VARS) root.style.setProperty(v, fg.hex);
        } else {
          // Los colores no hex vuelven al tema por defecto para evitar un cálculo erróneo.
          for (const v of BRAND_FOREGROUND_VARS) root.style.removeProperty(v);
        }
      }
    }
    return () => {
      for (const { cssVars } of BRIDGE) for (const v of cssVars) root.style.removeProperty(v);
      for (const v of BRAND_FOREGROUND_VARS) root.style.removeProperty(v);
    };
  }, [tokens.data]);

  return null;
}
