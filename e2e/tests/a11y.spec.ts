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

async function analyze(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  assertNoSeriousA11y(results);
}

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Páginas" })).toBeVisible();
}

test("login no tiene violaciones WCAG serious/critical", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await analyze(page);
});

test("vistas autenticadas no tienen violaciones WCAG serious/critical", async ({ page }) => {
  await login(page);

  for (const path of ["/", "/pages/new"]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await analyze(page);
  }
});
