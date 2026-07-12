import { defineConfig } from "@playwright/test";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://astrocms:astrocms@127.0.0.1:5434/astrocms";
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "e2e-secret-of-32-characters-min!!";

const CMS_PORT = 3000;
const ADMIN_PORT = 4300;

export default defineConfig({
  testDir: "./tests",
  testMatch: /a11y\.spec\.ts/,
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${ADMIN_PORT}`,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @astrocms/cms-server start",
      url: `http://127.0.0.1:${CMS_PORT}/healthz`,
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        DATABASE_URL,
        SESSION_SECRET,
        NODE_ENV: "development",
        CMS_PORT: String(CMS_PORT),
      },
    },
    {
      command: "pnpm --filter @astrocms/cms-admin dev",
      url: `http://localhost:${ADMIN_PORT}/`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { PORT: String(ADMIN_PORT) },
    },
  ],
});
