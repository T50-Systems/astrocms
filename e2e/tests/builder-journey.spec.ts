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

/** Selecciona un nodo del árbol por su tipo de bloque. dispatchEvent('click') dispara el
 * onClick de React (engine.select) sin que los listeners de arrastre de dnd-kit lo intercepten. */
async function selectTreeNode(page: Page, blockType: string) {
  await page.locator(`[data-testid="tree-node"][data-node-type="${blockType}"]`).first().dispatchEvent("click");
}

test("journey e2e: crear página con el builder, publicarla y verla renderizada en el sitio público", async ({
  page,
  context,
}) => {
  const suffix = Date.now().toString(36);
  const pageTitle = `Landing E2E ${suffix}`;
  const heroTitle = `Bienvenido a la landing ${suffix}`;
  const heroDescription = "Descripción del hero creada desde el journey e2e.";
  const headingText = `Sección destacada ${suffix}`;
  const paragraphText = "Párrafo de contenido introducido a través del inspector del builder.";
  const buttonLabel = "Contactar ahora";
  const buttonHref = "https://example.com/contacto";

  // 1. Login + cookies del admin también válidas en el host de la API (127.0.0.1:3000).
  await page.goto("/login");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.click('button[type="submit"]');
  await expect(page.getByRole("heading", { name: "Páginas" })).toBeVisible();
  await copyAdminCookiesToApiHost(context);

  // 2. "Página visual" crea una página builder de un clic y aterriza en /pages/:id/builder.
  await page.getByRole("button", { name: "Página visual" }).first().click();
  await page.waitForURL(/\/pages\/[0-9a-f-]+\/builder$/);
  const pageId = new URL(page.url()).pathname.match(/\/pages\/([^/]+)\/builder/)?.[1];
  expect(pageId).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Bloques" })).toBeVisible();
  await expect(page.getByText("Preview conectado")).toBeVisible();

  // 3. Renombrar la página desde el input del toolbar.
  const titleInput = page.getByLabel("Título de la página");
  await expect(titleInput).toHaveValue("Página sin título");
  await titleInput.fill(pageTitle);
  await titleInput.blur();
  await expect(async () => {
    const res = await page.request.get(`${CMS_API}/pages/${pageId}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).title).toBe(pageTitle);
  }).toPass({ timeout: 10_000 });

  // 4. Añadir los cuatro bloques. Nada está seleccionado todavía, así que cada uno
  // se inserta en la raíz (core/page) como hermano de los anteriores.
  await page.getByTestId("add-block-site/hero").click();
  await expect(page.getByText("2 nodos")).toBeVisible();
  await page.getByTestId("add-block-core/heading").click();
  await expect(page.getByText("3 nodos")).toBeVisible();
  await page.getByTestId("add-block-core/paragraph").click();
  await expect(page.getByText("4 nodos")).toBeVisible();
  await page.getByTestId("add-block-core/button").click();
  await expect(page.getByText("5 nodos")).toBeVisible();

  // 5. site/hero: title, description, alignment (select).
  await selectTreeNode(page, "site/hero");
  await page.locator('input[id$="-title"]').fill(heroTitle);
  await page.locator('textarea[id$="-description"]').fill(heroDescription);
  await page.locator('select[id$="-alignment"]').selectOption("right");

  // 6. core/heading: text, level (number).
  await selectTreeNode(page, "core/heading");
  await page.locator('input[id$="-text"]').fill(headingText);
  await page.locator('input[id$="-level"]').fill("2");

  // 7. core/paragraph: text.
  await selectTreeNode(page, "core/paragraph");
  await page.locator('textarea[id$="-text"]').fill(paragraphText);

  // 8. core/button: label, href.
  await selectTreeNode(page, "core/button");
  await page.locator('input[id$="-label"]').fill(buttonLabel);
  await page.locator('input[id$="-href"]').fill(buttonHref);

  // 9. Guardar y publicar.
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Guardado ✓")).toBeVisible();
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByText("Publicado ✓")).toBeVisible();

  // 10. Confirmar en la API pública que el documento publicado contiene el hero editado.
  const pageResponse = await page.request.get(`${CMS_API}/pages/${pageId}`);
  expect(pageResponse.status()).toBe(200);
  const entry = await pageResponse.json();
  expect(entry.builderDocumentId).toBeTruthy();
  expect(entry.slug).toBeTruthy();

  await expect(async () => {
    const docResponse = await page.request.get(`${CMS_API}/public/builder/documents/${entry.builderDocumentId}`);
    expect(docResponse.status()).toBe(200);
  }).toPass({ timeout: 10_000 });

  // 11. El sitio público (astro-demo) debe renderizar la página builder publicada en su slug real.
  await page.goto(`${PREVIEW_ORIGIN}${entry.slug}`);
  await expect(page.getByRole("heading", { name: heroTitle, level: 1 })).toBeVisible();
  await expect(page.getByText(heroDescription)).toBeVisible();
  await expect(page.getByRole("heading", { name: headingText, level: 2 })).toBeVisible();
  await expect(page.getByText(paragraphText)).toBeVisible();
  const publicButton = page.getByRole("link", { name: buttonLabel });
  await expect(publicButton).toBeVisible();
  await expect(publicButton).toHaveAttribute("href", buttonHref);
});
