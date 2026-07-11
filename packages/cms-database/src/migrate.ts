import { fileURLToPath } from "node:url";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client.js";

/** Aplica las migraciones SQL de /migrations. Reproducible e idempotente. */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no definido");
  const migrationsFolder = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../migrations",
  );
  const { db, close } = createDb(url, { max: 1 });
  console.log(`[db] migrando desde ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  await close();
  console.log("[db] migraciones aplicadas");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
