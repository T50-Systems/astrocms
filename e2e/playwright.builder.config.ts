import { defineConfig } from "@playwright/test";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://astrocms:astrocms@127.0.0.1:5434/astrocms";
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "e2e-secret-of-32-characters-min!!";

const CMS_PORT = 3000;
const ADMIN_PORT = 4300;
const PREVIEW_PORT = 4321;

export default defineConfig({
  testDir: "./tests",
  testMatch: /builder-flow\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
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
      command: "pnpm --filter @astrocms/astro-demo dev",
      url: `http://localhost:${PREVIEW_PORT}/`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        CMS_API_URL: `http://127.0.0.1:${CMS_PORT}/api/v1`,
        ADMIN_ORIGIN: `http://localhost:${ADMIN_PORT}`,
        PREVIEW_ORIGIN: `http://localhost:${PREVIEW_PORT}`,
      },
    },
    {
      command: "pnpm --filter @astrocms/cms-admin dev",
      url: `http://localhost:${ADMIN_PORT}/`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(ADMIN_PORT),
        VITE_PREVIEW_ORIGIN: `http://localhost:${PREVIEW_PORT}`,
        // Los e2e prueban el login real: desactiva el auto-login de desarrollo del admin.
        VITE_DEV_AUTOLOGIN: "false",
      },
    },
  ],
});
