import type { Session } from "@astrocms/contracts";
import type { CmsCore } from "@astrocms/cms-core";
import type { Env } from "./env.js";

declare module "fastify" {
  interface FastifyInstance {
    core: CmsCore;
    env: Env;
    siteId: string;
  }
  interface FastifyRequest {
    session?: Session;
  }
}
