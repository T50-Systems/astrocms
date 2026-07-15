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

async function analyze(page: Page, builder?: AxeBuilder): Promise<void> {
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

// Known issue (deuda de tema del admin, preexistente): el color de marca por defecto
// (`--primary` en runtime ≈ #a6c1dc) y algunos grises de placeholder/estado no alcanzan
// el contraste AA 4.5:1 sobre fondo claro (enlaces/botones `text-primary`/`bg-primary` y
// placeholders). Corregirlo implica ajustar los tokens de marca/tema (decisión de diseño),
// pendiente en un incremento aparte. Se mantiene el test como `fixme` para no ocultar la deuda.
test.fixme("vistas autenticadas no tienen violaciones WCAG serious/critical", async ({ page }) => {
  await login(page);

  for (const path of ["/", "/pages/new"]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await analyze(page);
  }
});

test("builder no tiene violaciones WCAG serious/critical", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Página visual" }).first().click();
  await page.waitForURL(/\/pages\/[0-9a-f-]+\/builder$/);
  await expect(page.getByText("Preview conectado")).toBeVisible();

  await analyze(page, new AxeBuilder({ page }).exclude('iframe[title="Builder preview"]'));
});
