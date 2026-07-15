import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const CMS_API = "http://127.0.0.1:3000/api/v1";
const PREVIEW_ORIGIN = "http://localhost:4321";
const ADMIN = { email: "admin@astrocms.local", password: "Admin!2345" };

async function copyAdminCookiesToApiHost(context: BrowserContext) {
  const cookies = await context.cookies("http://localhost:4300");
  await context.addCookies(
    cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: "127.0.0.1",
      path: cookie.path,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: false,
      sameSite: cookie.sameSite,
    })),
  );
}

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.click('button[type="submit"]');
  await expect(page.getByRole("heading", { name: "Páginas" })).toBeVisible();
}

function pageIdFromUrl(page: Page, suffix = "") {
  const pageId = new URL(page.url()).pathname.match(new RegExp(`/pages/([^/]+)${suffix}$`))?.[1];
  expect(pageId).toBeTruthy();
  return pageId!;
}

async function getPage(page: Page, pageId: string) {
  const response = await page.request.get(`${CMS_API}/pages/${pageId}`);
  expect(response.status()).toBe(200);
  return response.json() as Promise<{ slug: string; title: string }>;
}

test("journey e2e: página de texto crear → publicar → público → despublicar → 404", async ({ page, context }) => {
  const suffix = Date.now().toString(36);
  const title = `Página texto E2E ${suffix}`;
  const body = `Cuerpo de texto E2E ${suffix}`;

  await login(page);
  await copyAdminCookiesToApiHost(context);

  await page.goto("/pages/new");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Contenido").fill(body);
  await page.getByRole("button", { name: "Crear borrador" }).click();
  await page.waitForURL(/\/pages\/[0-9a-f-]+$/);
  const pageId = pageIdFromUrl(page);
  await expect(page.getByText("Borrador", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByText("Publicada", { exact: true }).first()).toBeVisible();
  const { slug } = await getPage(page, pageId);
  expect(slug).toMatch(/^\//);

  const publicResponse = await page.goto(`${PREVIEW_ORIGIN}${slug}`);
  expect(publicResponse?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  await expect(page.getByText(body)).toBeVisible();

  await page.goto(`/pages/${pageId}`);
  await expect(page.getByRole("button", { name: "Despublicar", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Despublicar", exact: true }).click();
  await expect(page.getByText("Borrador", { exact: true }).first()).toBeVisible();

  const unpublishedResponse = await page.goto(`${PREVIEW_ORIGIN}${slug}`);
  expect(unpublishedResponse?.status()).toBe(404);
  await expect(page.getByText("Página no encontrada")).toBeVisible();
});

test("journey e2e: plantilla Landing → builder → publicar → público", async ({ page, context }) => {
  const suffix = Date.now().toString(36);
  const pageTitle = `Landing E2E ${suffix}`;

  await login(page);
  await copyAdminCookiesToApiHost(context);

  await page.getByRole("button", { name: "Plantillas" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /Landing/ }).click();
  await page.waitForURL(/\/pages\/[0-9a-f-]+\/builder$/);
  const pageId = pageIdFromUrl(page, "/builder");
  await expect(page.getByText("Preview conectado")).toBeVisible();

  const preview = page.frameLocator('iframe[title="Builder preview"]');
  await expect(preview.locator('[data-builder-type="site/hero"]')).toBeVisible({ timeout: 15_000 });
  await expect(preview.locator('[data-builder-type="site/cta"]')).toBeVisible({ timeout: 15_000 });

  const titleInput = page.getByLabel("Título de la página");
  await titleInput.fill(pageTitle);
  await titleInput.blur();
  await expect(async () => {
    expect((await getPage(page, pageId)).title).toBe(pageTitle);
  }).toPass({ timeout: 10_000 });

  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByText("Publicado ✓")).toBeVisible();
  const { slug } = await getPage(page, pageId);
  expect(slug).toMatch(/^\//);

  const publicResponse = await page.goto(`${PREVIEW_ORIGIN}${slug}`);
  expect(publicResponse?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Haz crecer tu próximo proyecto", level: 1 })).toBeVisible();
  await expect(page.getByText("¿Listo para dar el siguiente paso?")).toBeVisible();
});
