import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemStorageDriver, InvalidStorageKeyError, type StorageDriver } from "./index.js";

describe("filesystem storage driver", () => {
  let root = "";
  let storage: StorageDriver;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "astrocms-storage-"));
    storage = createFilesystemStorageDriver({ rootDir: root, publicBaseUrl: "/files" });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("stores, reads, checks and deletes bytes", async () => {
    const key = "site-a/original/image.png";
    const bytes = new Uint8Array([1, 2, 3, 4]);

    expect(await storage.exists(key)).toBe(false);
    await storage.put(key, bytes, "image/png");

    expect(await storage.exists(key)).toBe(true);
    expect(Array.from(await storage.get(key))).toEqual([1, 2, 3, 4]);
    expect(storage.url(key)).toBe("/files/site-a/original/image.png");

    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
  });

  it.each(["../x", "a/../x", "/absolute", "a\\b", "a//b", " a", "a "])(
    "rejects unsafe key %s",
    async (key) => {
      await expect(storage.put(key, new Uint8Array([1]), "application/octet-stream")).rejects.toBeInstanceOf(
        InvalidStorageKeyError,
      );
      expect(() => storage.url(key)).toThrow(InvalidStorageKeyError);
    },
  );
});
