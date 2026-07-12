import { expect, test } from "@playwright/test";

const CMS_API = "http://127.0.0.1:3000/api/v1";
const ADMIN = { email: "admin@astrocms.local", password: "Admin!2345" };

test("criterio de éxito (CMS): login → crear página → publicar → visible en API pública", async ({ page, request }) => {
  const slug = `/e2e-${Date.now().toString(36)}`;
  const title = "Página E2E";

  // 1. Login.
  await page.goto("/login");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.click('button[type="submit"]');
  await expect(page.getByRole("heading", { name: "Páginas" })).toBeVisible();

  // 2. Crear página.
  await page.getByRole("button", { name: "Nueva página" }).click();
  await page.fill("#title", title);
  await page.fill("#slug", slug);
  await page.fill("#body", "Contenido publicado desde el e2e.");
  await page.getByRole("button", { name: "Crear borrador" }).click();

  // 3. Editor de la página creada (draft, v1).
  await expect(page.getByRole("heading", { name: `Editar: ${title}` })).toBeVisible();
  await expect(page.getByText("draft")).toBeVisible();

  // 4. La API pública AÚN no la devuelve (draft oculto).
  const before = await request.get(`${CMS_API}/public/pages?slug=${encodeURIComponent(slug)}`);
  expect(before.status()).toBe(404);

  // 5. Publicar.
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("published")).toBeVisible();

  // 6. Ahora la API pública SÍ la devuelve (sólo contenido publicado).
  await expect(async () => {
    const after = await request.get(`${CMS_API}/public/pages?slug=${encodeURIComponent(slug)}`);
    expect(after.status()).toBe(200);
    expect((await after.json()).title).toBe(title);
  }).toPass({ timeout: 10_000 });
});
