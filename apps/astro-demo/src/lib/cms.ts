import { createCmsClient } from "@astrocms/cms-sdk";

/** Cliente del CMS para SSR: usa la API pública (sólo contenido publicado). */
export function getCms() {
  const baseUrl = process.env.CMS_API_URL ?? "http://127.0.0.1:3000/api/v1";
  return createCmsClient({ baseUrl });
}
