import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StorageDriver {
  put(key: string, bytes: Uint8Array, mime: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  url(key: string): string;
}

export interface FilesystemStorageOptions {
  rootDir: string;
  publicBaseUrl?: string;
}

export class InvalidStorageKeyError extends Error {
  constructor(key: string) {
    super(`storage key inválida: ${key}`);
    this.name = "InvalidStorageKeyError";
  }
}

function normalizeKey(key: string): string {
  if (key.trim() !== key || key.length === 0) throw new InvalidStorageKeyError(key);
  if (key.includes("\\") || key.includes("\0") || key.includes(":")) {
    throw new InvalidStorageKeyError(key);
  }
  if (key.startsWith("/") || path.isAbsolute(key)) throw new InvalidStorageKeyError(key);
  const segments = key.split("/");
  if (segments.some((part) => part.length === 0 || part === "." || part === "..")) {
    throw new InvalidStorageKeyError(key);
  }
  const normalized = path.posix.normalize(key);
  if (normalized !== key || normalized.startsWith("../")) throw new InvalidStorageKeyError(key);
  return normalized;
}

function keyPath(rootDir: string, key: string): string {
  const safeKey = normalizeKey(key);
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, ...safeKey.split("/"));
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new InvalidStorageKeyError(key);
  return resolved;
}

function joinUrl(base: string, key: string): string {
  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${cleanBase}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function createFilesystemStorageDriver(opts: FilesystemStorageOptions): StorageDriver {
  const rootDir = path.resolve(opts.rootDir);
  const publicBaseUrl = opts.publicBaseUrl ?? "/storage";

  return {
    async put(key, bytes, _mime) {
      const file = keyPath(rootDir, key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(bytes));
    },
    async get(key) {
      return readFile(keyPath(rootDir, key));
    },
    async delete(key) {
      await rm(keyPath(rootDir, key), { force: true });
    },
    async exists(key) {
      try {
        const entry = await stat(keyPath(rootDir, key));
        return entry.isFile();
      } catch (err) {
        if (typeof err === "object" && err !== null && (err as { code?: string }).code === "ENOENT") {
          return false;
        }
        throw err;
      }
    },
    url(key) {
      return joinUrl(publicBaseUrl, normalizeKey(key));
    },
  };
}
