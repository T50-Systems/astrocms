import { builderDocumentSchema } from "@astrocms/contracts";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import BlockRenderer from "../../builder/BlockRenderer.astro";
import { getCms } from "../../lib/cms.ts";

export const prerender = false;

export async function POST({ request }: { request: Request }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Solicitud inválida", { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return new Response("Solicitud inválida", { status: 400 });
  }

  const { document: inputDocument, token } = body as Record<string, unknown>;
  const parsedDocument = builderDocumentSchema.safeParse(inputDocument);
  if (!parsedDocument.success || typeof token !== "string" || token.length === 0) {
    return new Response("Solicitud inválida", { status: 400 });
  }

  const document = parsedDocument.data;
  try {
    await getCms().preview.getBuilderDocument(document.id, token);
  } catch {
    return new Response("Preview no autorizado", { status: 401 });
  }

  try {
    const container = await AstroContainer.create();
    const html = await container.renderToString(BlockRenderer, {
      props: { node: document.root, preview: true },
    });
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch {
    return new Response("No se pudo renderizar el preview", { status: 500 });
  }
}
