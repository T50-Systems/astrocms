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
  const slug = `/be-${suffix}`;
  const title = `Builder E2E ${suffix}`;

  await page.goto("/login");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.click('button[type="submit"]');
  await expect(page.getByRole("heading", { name: "Páginas" })).toBeVisible();
  await copyAdminCookiesToApiHost(context);

  await page.getByRole("button", { name: "Nueva página" }).click();
  await page.fill("#title", title);
  await page.fill("#slug", slug);
  await page.getByRole("button", { name: "Crear borrador" }).click();

  await expect(
    page.getByRole("heading", { name: `Editar: ${title}` }),
  ).toBeVisible();
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
