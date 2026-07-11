import node from "@astrojs/node";
import { defineConfig } from "astro/config";

// SSR on-demand (ADR-0002): publicar se ve al instante; la ruta de preview será SSR.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { port: 4321 },
});
