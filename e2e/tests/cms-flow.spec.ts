import { expect, test } from "@playwright/test";

const CMS_API = "http://127.0.0.1:3000/api/v1";
const ADMIN = { email: "admin@astrocms.local", password: "Admin!2345" };

test("criterio de éxito (CMS): login → crear página → publicar → visible en API pública", async ({ page, request }) => {
  // Título único: el slug se autogenera a partir del título (como WordPress).
  const title = `Página E2E ${Date.now().toString(36)}`;

  // 1. Login.
  await page.goto("/login");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.click('button[type="submit"]');
  await expect(page.getByRole("heading", { name: "Páginas" })).toBeVisible();

  // 2. Crear página.
  // .first(): con la lista vacía el EmptyState muestra un segundo botón "Añadir nueva".
  await page.getByRole("button", { name: "Añadir nueva" }).first().click();
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Contenido").fill("Contenido publicado desde el e2e.");
  await page.getByRole("button", { name: "Crear borrador" }).click();

  // 3. Editor de la página creada (borrador, v1).
  await page.waitForURL(/\/pages\/[0-9a-f-]+$/);
  await expect(page.getByLabel("Título")).toHaveValue(title);
  // exact + .first(): el badge "Borrador" aparece dos veces (cabecera y panel lateral).
  await expect(page.getByText("Borrador", { exact: true }).first()).toBeVisible();
  const pageId = new URL(page.url()).pathname.match(/\/pages\/([^/]+)/)?.[1];
  expect(pageId).toBeTruthy();

  // Slug real autogenerado: se pide vía el proxy /api del admin (misma-origin → lleva la sesión).
  const entryResponse = await page.request.get(`/api/v1/pages/${pageId}`);
  expect(entryResponse.status()).toBe(200);
  const slug: string = (await entryResponse.json()).slug;
  expect(slug).toMatch(/^\//);

  // 4. La API pública AÚN no la devuelve (draft oculto).
  const before = await request.get(`${CMS_API}/public/pages?slug=${encodeURIComponent(slug)}`);
  expect(before.status()).toBe(404);

  // 5. Publicar.
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Publicada", { exact: true }).first()).toBeVisible();

  // 6. Ahora la API pública SÍ la devuelve (sólo contenido publicado).
  await expect(async () => {
    const after = await request.get(`${CMS_API}/public/pages?slug=${encodeURIComponent(slug)}`);
    expect(after.status()).toBe(200);
    expect((await after.json()).title).toBe(title);
  }).toPass({ timeout: 10_000 });
});
