import { expect, test, type BrowserContext } from "@playwright/test";

const CMS_API = "http://127.0.0.1:3000/api/v1";
const ADMIN = { email: "admin@astrocms.local", password: "Admin!2345" };
const HERO_TITLE = "Hola desde E2E";

interface BuilderNode {
  type: string;
  props?: Record<string, unknown>;
  children?: BuilderNode[];
}

function findNode(
  node: BuilderNode,
  predicate: (node: BuilderNode) => boolean,
): BuilderNode | undefined {
  if (predicate(node)) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return undefined;
}

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

test("criterio de éxito (builder visual): crea hero, guarda, publica y queda disponible en API pública", async ({
  page,
  context,
}) => {
  const suffix = Date.now().toString(36);
  const title = `Builder E2E ${suffix}`;

  await page.goto("/login");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.click('button[type="submit"]');
  await expect(page.getByRole("heading", { name: "Páginas" })).toBeVisible();
  await copyAdminCookiesToApiHost(context);

  // .first(): con la lista vacía el EmptyState muestra un segundo botón "Añadir nueva".
  await page.getByRole("button", { name: "Añadir nueva" }).first().click();
  await page.getByLabel("Título").fill(title);
  // El slug se autogenera a partir del título (como WordPress); no se rellena.
  await page.getByRole("button", { name: "Crear borrador" }).click();

  await page.waitForURL(/\/pages\/[0-9a-f-]+$/);
  await expect(page.getByLabel("Título")).toHaveValue(title);
  const pageId = new URL(page.url()).pathname.match(/\/pages\/([^/]+)/)?.[1];
  expect(pageId).toBeTruthy();

  await page.goto(`/pages/${pageId}/builder`);
  await expect(page.getByRole("heading", { name: "Bloques" })).toBeVisible();
  await expect(page.getByRole("button", { name: "core/page" })).toBeVisible();
  await expect(page.getByText("Preview conectado")).toBeVisible();

  // Insertar un Hero desde el panel de bloques.
  await page.getByTestId("add-block-site/hero").click();
  await expect(page.getByText("2 nodos")).toBeVisible();

  // Seleccionar el Hero en el árbol → el inspector genera sus campos.
  // dispatchEvent('click') dispara el onClick de React sin que los listeners de dnd-kit lo intercepten.
  await page.locator('[data-testid="tree-node"][data-node-type="site/hero"]').dispatchEvent("click");
  const titleInput = page.locator('input[id$="-title"]');
  await expect(titleInput).toBeVisible();
  await titleInput.fill(HERO_TITLE);

  // Guardar el draft y publicar.
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: "Publicar", exact: true }).click();

  const pageResponse = await page.request.get(`${CMS_API}/pages/${pageId}`);
  expect(pageResponse.status()).toBe(200);
  const entry = await pageResponse.json();
  expect(entry.builderDocumentId).toBeTruthy();

  await expect(async () => {
    const docResponse = await page.request.get(
      `${CMS_API}/public/builder/documents/${entry.builderDocumentId}`,
    );
    expect(docResponse.status()).toBe(200);
    const document = await docResponse.json();
    const hero = findNode(document.root, (node) => node.type === "site/hero");
    expect(hero?.props?.title).toBe(HERO_TITLE);
  }).toPass({ timeout: 10_000 });
});

test("el preview refleja los cambios estructurales al guardar (recarga del iframe)", async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  const title = `Reload E2E ${suffix}`;

  await page.goto("/login");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.click('button[type="submit"]');
  await expect(page.getByRole("heading", { name: "Páginas" })).toBeVisible();

  await page.getByRole("button", { name: "Añadir nueva" }).first().click();
  await page.getByLabel("Título").fill(title);
  await page.getByRole("button", { name: "Crear borrador" }).click();
  await page.waitForURL(/\/pages\/[0-9a-f-]+$/);
  const pageId = new URL(page.url()).pathname.match(/\/pages\/([^/]+)/)?.[1];

  await page.goto(`/pages/${pageId}/builder`);
  await expect(page.getByText("Preview conectado")).toBeVisible();

  const preview = page.frameLocator('iframe[title="Builder preview"]');
  const heroInPreview = preview.locator('[data-builder-type="site/hero"]');

  // El documento recién creado no tiene hero → el preview tampoco.
  await expect(heroInPreview).toHaveCount(0);

  // Insertar un Hero (cambio ESTRUCTURAL). El preview solo parchea props en vivo,
  // así que el hero NO debe aparecer todavía en el iframe pese a estar en el árbol.
  await page.getByTestId("add-block-site/hero").click();
  await expect(page.getByText("2 nodos")).toBeVisible();
  await expect(heroInPreview).toHaveCount(0);

  // Guardar: la estructura cambió → el host envía host/reload-preview → el iframe
  // recarga y SSR-renderiza el documento guardado, ahora CON el hero.
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(heroInPreview).toBeVisible({ timeout: 10_000 });
});

test("atajos de teclado de nodo: Supr elimina, Ctrl+D duplica, Escape deselecciona", async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  const title = `Atajos E2E ${suffix}`;

  await page.goto("/login");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.click('button[type="submit"]');
  await expect(page.getByRole("heading", { name: "Páginas" })).toBeVisible();

  await page.getByRole("button", { name: "Añadir nueva" }).first().click();
  await page.getByLabel("Título").fill(title);
  await page.getByRole("button", { name: "Crear borrador" }).click();
  await page.waitForURL(/\/pages\/[0-9a-f-]+$/);
  const pageId = new URL(page.url()).pathname.match(/\/pages\/([^/]+)/)?.[1];

  await page.goto(`/pages/${pageId}/builder`);
  await expect(page.getByText("Preview conectado")).toBeVisible();

  const selectHero = async () =>
    // dispatchEvent('click') dispara el onClick de React (engine.select) sin que dnd-kit lo intercepte.
    page.locator('[data-testid="tree-node"][data-node-type="site/hero"]').first().dispatchEvent("click");

  // Insertar hero → 2 nodos (root + hero).
  await page.getByTestId("add-block-site/hero").click();
  await expect(page.getByText("2 nodos")).toBeVisible();

  // Seleccionar el hero y duplicarlo con Ctrl+D → 3 nodos.
  await selectHero();
  await page.keyboard.press("Control+d");
  await expect(page.getByText("3 nodos")).toBeVisible();

  // Seleccionar un hero y eliminarlo con Supr → 2 nodos.
  await selectHero();
  await page.keyboard.press("Delete");
  await expect(page.getByText("2 nodos")).toBeVisible();

  // Escape deselecciona (el inspector vuelve a su estado sin selección).
  await selectHero();
  await expect(page.getByText("site/hero")).toBeVisible(); // inspector muestra el tipo del nodo seleccionado
  await page.keyboard.press("Escape");
  await expect(page.getByText("Selecciona un nodo para editar sus propiedades.")).toBeVisible();
});

test("el breakpoint redimensiona el preview (responsive)", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const title = `Responsive E2E ${suffix}`;

  // Viewport ancho para que el panel de lienzo supere holgadamente los 390px del móvil.
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/login");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.click('button[type="submit"]');
  await expect(page.getByRole("heading", { name: "Páginas" })).toBeVisible();

  await page.getByRole("button", { name: "Añadir nueva" }).first().click();
  await page.getByLabel("Título").fill(title);
  await page.getByRole("button", { name: "Crear borrador" }).click();
  await page.waitForURL(/\/pages\/[0-9a-f-]+$/);
  const pageId = new URL(page.url()).pathname.match(/\/pages\/([^/]+)/)?.[1];

  await page.goto(`/pages/${pageId}/builder`);
  await expect(page.getByText("Preview conectado")).toBeVisible();

  const frame = page.locator('iframe[title="Builder preview"]');

  // Por defecto abre en el breakpoint más ancho (desktop) → ancho completo del panel.
  const fullBox = await frame.boundingBox();
  expect(fullBox?.width ?? 0).toBeGreaterThan(500);

  // Seleccionar "mobile" → el iframe se constriñe a 390px (su viewport, no solo un data-attr).
  await page.selectOption("#builder-breakpoint", "mobile");
  await expect(async () => {
    const box = await frame.boundingBox();
    // ~390px (el boundingBox incluye el borde de 1px del iframe).
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(390);
    expect(box?.width ?? 0).toBeLessThanOrEqual(393);
  }).toPass({ timeout: 5_000 });
  await expect(page.getByText("390px")).toBeVisible();

  // Volver a "desktop" → ancho completo de nuevo.
  await page.selectOption("#builder-breakpoint", "desktop");
  await expect(async () => {
    const box = await frame.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(500);
  }).toPass({ timeout: 5_000 });
});
