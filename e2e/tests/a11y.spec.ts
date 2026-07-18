import { expect, type Page, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import type { AxeResults, Result } from "axe-core";

const ADMIN = { email: "admin@astrocms.local", password: "Admin!2345" };
const WCAG_TAGS = ["wcag2a", "wcag2aa"];

function formatViolations(violations: Result[]): string {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => {
          const target = node.target.join(", ");
          const summary = node.failureSummary?.trim() ?? "sin detalle";
          return `  - ${target}: ${summary}`;
        })
        .join("\n");
      return `${violation.id} (${violation.impact ?? "sin impacto"})\n${nodes}`;
    })
    .join("\n\n");
}

function assertNoSeriousA11y(results: AxeResults): void {
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, formatViolations(serious)).toEqual([]);
}

/**
 * Congela animaciones/transiciones antes de que axe muestree los colores.
 *
 * Las vistas del panel entran con `animate-in fade-in-0 slide-in-…`; durante esos ~200ms
 * el contenedor tiene `opacity` fraccional. axe-core deriva el color efectivo componiendo
 * la pila visual (elementsFromPoint), así que si muestrea a mitad de la animación mezcla el
 * texto/fondo con ese alpha y reporta un contraste FALSO (p. ej. lee el azul de marca real
 * #2c6fae como #88add0 → 2.24:1). En estado asentado los tokens del TEMA POR DEFECTO/seed
 * cumplen AA (enlace #2c6fae ≈5:1 sobre gris-50; muted-foreground L=.50); el fallo era
 * puramente temporal. Anular animación/transición deja la UI en su estado final de forma
 * determinista y elimina la dependencia del timing.
 *
 * NOTA: este test solo ejercita el tema por defecto. Un `color.brand` DTCG a medida podría
 * degradar el contraste vía DesignTokensBridge y NO lo cubre esta prueba (follow-up aparte:
 * validar contraste al guardar tokens). CONVENCIÓN: el override universal deja los elementos
 * en su estado base (opacity:1, transform final) = totalmente visibles hoy; si en el futuro
 * se añade una animación cuyo estado *base* oculte contenido, debe traer su propio chequeo
 * a11y del estado asentado (o acotar aquí el selector) para no enmascararlo.
 */
async function freezeAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: "*, *::before, *::after { animation: none !important; transition: none !important; }",
  });
  // Espera un paint para que el estado congelado (opacity final) se refleje en el compositor.
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

async function analyze(page: Page, builder?: AxeBuilder): Promise<void> {
  await freezeAnimations(page);
  const results = await (builder ?? new AxeBuilder({ page })).withTags(WCAG_TAGS).analyze();
  assertNoSeriousA11y(results);
}

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Páginas" })).toBeVisible();
}

test("login no tiene violaciones WCAG serious/critical", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Iniciar sesión", { exact: true })).toBeVisible();
  await analyze(page);
});

test("vistas autenticadas no tienen violaciones WCAG serious/critical", async ({ page }) => {
  await login(page);

  // Espera contenido ASENTADO de cada ruta antes de escanear: `/pages/new` es una ruta
  // lazy (code-splitting F3a), así que el <main> muestra primero el skeleton de Suspense.
  // Escanear ahí analizaría el fallback, no la página real. Anclamos a un elemento propio
  // de cada página cargada (ausente en el skeleton).
  const settled: Record<string, () => Promise<void>> = {
    "/": () => expect(page.getByRole("heading", { name: "Páginas" })).toBeVisible(),
    "/pages/new": () => expect(page.getByRole("button", { name: "Crear borrador" })).toBeVisible(),
  };
  for (const [path, waitSettled] of Object.entries(settled)) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await waitSettled();
    await analyze(page);
  }
});

test("builder no tiene violaciones WCAG serious/critical", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Página visual" }).first().click();
  await page.waitForURL(/\/pages\/[0-9a-f-]+\/builder$/);
  await expect(page.getByText("Preview conectado")).toBeVisible();

  await analyze(page, new AxeBuilder({ page }).exclude('iframe[title="Builder preview"]'));

  // La vista Wireframe introduce barras de color con texto y controles propios: axe debe
  // escanearla también (el iframe de preview sigue excluido — su a11y se cubre en el sitio).
  await page.getByRole("button", { name: "Wireframe" }).click();
  await expect(page.getByTestId("wireframe-view")).toBeVisible();
  await analyze(page, new AxeBuilder({ page }).exclude('iframe[title="Builder preview"]'));
});
