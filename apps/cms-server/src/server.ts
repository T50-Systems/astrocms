import { createCmsCore } from "@astrocms/cms-core";
import { createDb } from "@astrocms/cms-database";
import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

async function main() {
  const env = loadEnv();
  const { db, close } = createDb(env.DATABASE_URL);

  // Resuelve el site único (single-site) una vez al arrancar.
  const siteId = await createCmsCore({ db }).resolvePrimarySiteId();

  const app = await buildApp({ env, db, siteId });

  const shutdown = async () => {
    await app.close();
    await close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ port: env.CMS_PORT, host: "0.0.0.0" });
  app.log.info(`cms-server escuchando en :${env.CMS_PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
