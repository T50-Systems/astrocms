import type { FastifyInstance } from "fastify";
import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

const durationBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

/** Registra métricas HTTP de baja cardinalidad y su endpoint de exposición. */
export function registerMetrics(app: FastifyInstance): void {
  const register = new Registry();

  // prom-client mantiene un intervalo para estas métricas; evitarlo permite que Vitest cierre limpio.
  if (process.env.NODE_ENV !== "test") collectDefaultMetrics({ register });

  const requestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds.",
    labelNames: ["method", "route", "status_code"],
    buckets: durationBuckets,
    registers: [register],
  });
  const requests = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests.",
    labelNames: ["method", "route", "status_code"],
    registers: [register],
  });

  app.addHook("onResponse", (request, reply, done) => {
    const route = request.routeOptions?.url ?? "unknown";
    if (route !== "/metrics") {
      const labels = {
        method: request.method,
        route,
        status_code: String(reply.statusCode),
      };
      requests.inc(labels);
      requestDuration.observe(labels, reply.elapsedTime / 1_000);
    }
    done();
  });

  app.get("/metrics", async (_request, reply) => {
    reply.header("content-type", register.contentType);
    return reply.send(await register.metrics());
  });
}
