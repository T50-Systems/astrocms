import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "./main.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("astrocms CLI", () => {
  it("manifest --json produce JSON parseable con blocks y tokens", async () => {
    const result = await runCli(["manifest", "--json"]);

    expect(result.exitCode).toBe(0);
    const manifest = JSON.parse(result.stdout) as { blocks?: unknown[]; tokens?: Record<string, unknown> };
    expect(Array.isArray(manifest.blocks)).toBe(true);
    expect(manifest.blocks?.length).toBeGreaterThan(0);
    expect(manifest.tokens?.spacing).toBeDefined();
  });

  it("generate block test/foo --dir <tmp> crea los ficheros esperados", async () => {
    const dir = await mkdtemp(path.join(process.cwd(), ".tmp-cli-"));
    tempDirs.push(dir);

    const result = await runCli(["generate", "block", "test/foo", "--category", "Test", "--dir", dir, "--json"]);

    expect(result.exitCode).toBe(0);
    expect(existsSync(path.join(dir, "src", "builder", "blocks", "test", "foo.ts"))).toBe(true);
    expect(existsSync(path.join(dir, "src", "components", "builder", "TestFoo.astro"))).toBe(true);
    const payload = JSON.parse(result.stdout) as { created?: string[] };
    expect(payload.created?.length).toBe(2);
  });
});
