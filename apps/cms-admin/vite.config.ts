import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const workspace = (path: string) =>
  new URL(`../../${path}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const srcAlias = new URL("./src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// El panel se sirve en :5173 y el API en :3000. El proxy hace que /api sea
// same-origin → las cookies HttpOnly/CSRF funcionan sin CORS ni SameSite=None.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": srcAlias,
      "@astrocms/builder-adapters/cms": workspace("packages/builder-adapters/src/cms.ts"),
      "@astrocms/builder-core": workspace("packages/builder-core/src/index.ts"),
      "@astrocms/builder-react": workspace("packages/builder-react/src/index.ts"),
    },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
    },
  },
});
