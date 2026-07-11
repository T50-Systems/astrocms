import type { FastifyInstance } from "fastify";
import { pingDb, type Database } from "@astrocms/cms-database";

/** Health check: liveness + comprobación de conectividad con la base. */
export async function healthRoutes(app: FastifyInstance, db: Database): Promise<void> {
  app.get("/healthz", async (_req, reply) => {
    const ok = await pingDb(db);
    return ok
      ? reply.send({ status: "ok", db: true })
      : reply.code(503).send({ status: "degraded", db: false });
  });
}
