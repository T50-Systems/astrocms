import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { blockManifestSchema } from "@astrocms/contracts";
import { demoBuilderManifest } from "@astrocms/schemas";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface CliError {
  code: string;
  path?: string;
  message: string;
  suggestion?: string;
}

interface Options {
  json: boolean;
  category?: string;
  dir: string;
}

export async function runCli(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<CliResult> {
  const parsed = parseArgs(args);
  if (!parsed.ok) return errorResult(parsed.error, parsed.json);
  const { command, rest, options } = parsed.value;

  try {
    if (command === "manifest") return ok(demoBuilderManifest, options.json);
    if (command === "validate") return validate(options.json);
    if (command === "generate") return generate(rest, options);
    if (command === "db:migrate") return runDatabaseScript("migrate", env, options.json);
    if (command === "db:seed") return runDatabaseScript("seed", env, options.json);
    return errorResult(
      {
        code: "unknown_command",
        message: `Comando no soportado: ${command}`,
        suggestion: "Usa manifest, validate, generate block, db:migrate o db:seed.",
      },
      options.json,
    );
  } catch (error) {
    return errorResult(toCliError(error), options.json);
  }
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const result = await runCli(args);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}

function parseArgs(args: string[]):
  | { ok: true; value: { command: string; rest: string[]; options: Options } }
  | { ok: false; json: boolean; error: CliError } {
  const options: Options = { json: false, dir: process.cwd() };
  const rest: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--category") {
      const value = args[index + 1];
      if (!value) {
        return { ok: false, json: options.json, error: missingValue("--category") };
      }
      options.category = value;
      index += 1;
      continue;
    }
    if (arg === "--dir") {
      const value = args[index + 1];
      if (!value) return { ok: false, json: options.json, error: missingValue("--dir") };
      options.dir = value;
      index += 1;
      continue;
    }
    rest.push(arg);
  }

  const command = rest.shift();
  if (!command) {
    return {
      ok: false,
      json: options.json,
      error: {
        code: "missing_command",
        message: "Falta un comando.",
        suggestion: "Usa manifest --json, validate o generate block <tipo> --category <cat>.",
      },
    };
  }
  return { ok: true, value: { command, rest, options } };
}

function validate(json: boolean): CliResult {
  const parsed = blockManifestSchema.safeParse(demoBuilderManifest);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => ({
      code: "manifest_invalid",
      path: issue.path.join("."),
      message: issue.message,
      suggestion: "Corrige la definicion declarativa del bloque o token indicado.",
    }));
    return {
      exitCode: 1,
      stdout: json ? `${JSON.stringify({ ok: false, errors }, null, 2)}\n` : "",
      stderr: json ? "" : errors.map(formatError).join("\n"),
    };
  }
  return ok({ ok: true, blocks: parsed.data.blocks.length, tokens: Object.keys(parsed.data.tokens) }, json);
}

async function generate(rest: string[], options: Options): Promise<CliResult> {
  const subcommand = rest[0];
  const type = rest[1];
  if (subcommand !== "block" || !type) {
    return errorResult(
      {
        code: "invalid_generate_target",
        message: "Uso: generate block <tipo> --category <cat> [--dir <ruta>]",
        suggestion: "Ejemplo: astrocms generate block marketing/hero --category Marketing",
      },
      options.json,
    );
  }
  if (!options.category) {
    return errorResult(
      {
        code: "missing_category",
        path: "--category",
        message: "generate block requiere --category.",
        suggestion: "Indica una categoria visible para el editor de bloques.",
      },
      options.json,
    );
  }

  const result = await scaffoldBlock({ rootDir: options.dir, type, category: options.category });
  return ok(result, options.json);
}

export async function scaffoldBlock(args: { rootDir: string; type: string; category: string }) {
  const normalizedType = args.type.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalizedType || normalizedType.includes("..")) {
    throw {
      code: "invalid_block_type",
      path: "type",
      message: "El tipo de bloque no puede estar vacio ni contener '..'.",
      suggestion: "Usa una ruta logica como marketing/hero o test/foo.",
    } satisfies CliError;
  }

  const componentName = toPascalCase(normalizedType);
  const blockPath = path.join(args.rootDir, "src", "builder", "blocks", `${normalizedType}.ts`);
  const componentPath = path.join(args.rootDir, "src", "components", "builder", `${componentName}.astro`);
  const created: string[] = [];
  const skipped: string[] = [];

  await writeIfMissing(blockPath, blockTemplate(normalizedType, args.category, componentName), created, skipped);
  await writeIfMissing(componentPath, componentTemplate(componentName, normalizedType), created, skipped);

  return {
    ok: true,
    type: normalizedType,
    files: { block: blockPath, component: componentPath },
    created,
    skipped,
  };
}

async function writeIfMissing(filePath: string, contents: string, created: string[], skipped: string[]): Promise<void> {
  if (existsSync(filePath)) {
    skipped.push(filePath);
    return;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
  created.push(filePath);
}

function blockTemplate(type: string, category: string, componentName: string): string {
  return `import { defineBlock, text } from "@astrocms/schemas";

export const ${toIdentifier(componentName)}Block = defineBlock({
  type: "${type}",
  label: "${componentName}",
  category: "${category}",
  version: 1,
  component: "src/components/builder/${componentName}.astro",
  fields: {
    title: text({ label: "Titulo", required: true, maxLength: 120, default: "${componentName}" }),
  },
  constraints: { allowedParents: ["core/page", "core/section"] },
});
`;
}

function componentTemplate(componentName: string, type: string): string {
  return `---
interface Props {
  title?: string;
}

const { title = "${componentName}" } = Astro.props;
---

<section data-block-type="${type}">
  <h2>{title}</h2>
</section>
`;
}

function toPascalCase(value: string): string {
  const words = value.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return words.map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`).join("") || "Block";
}

function toIdentifier(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9_$]/g, "");
  return /^[a-zA-Z_$]/.test(safe) ? safe : `Block${safe}`;
}

async function runDatabaseScript(kind: "migrate" | "seed", env: NodeJS.ProcessEnv, json: boolean): Promise<CliResult> {
  if (!env.DATABASE_URL) {
    return errorResult({
      code: "missing_database_url",
      path: "DATABASE_URL",
      message: "DATABASE_URL no esta definido.",
      suggestion: "Exporta DATABASE_URL antes de ejecutar db:migrate o db:seed.",
    }, json);
  }

  const scriptPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    `../../cms-database/src/${kind}.ts`,
  );
  const child = spawn(process.execPath, ["--import", "tsx/esm", scriptPath], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (!child.stdout || !child.stderr) {
    return errorResult({
      code: "spawn_error",
      message: "No se pudieron capturar stdout/stderr del proceso de base de datos.",
      suggestion: "Ejecuta el comando de nuevo y revisa permisos del entorno local.",
    }, json);
  }
  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(child.stdout),
    readStream(child.stderr),
    new Promise<number>((resolve) => child.on("close", (code) => resolve(code ?? 1))),
  ]);
  return { exitCode, stdout, stderr };
}

function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function ok(data: unknown, json: boolean): CliResult {
  if (json) return { exitCode: 0, stdout: `${JSON.stringify(data, null, 2)}\n`, stderr: "" };
  return { exitCode: 0, stdout: `${formatHuman(data)}\n`, stderr: "" };
}

function errorResult(error: CliError, json = false): CliResult {
  const payload = { ok: false, error };
  return {
    exitCode: 1,
    stdout: json ? `${JSON.stringify(payload, null, 2)}\n` : "",
    stderr: json ? "" : `${formatError(error)}\n`,
  };
}

function missingValue(flag: string): CliError {
  return {
    code: "missing_value",
    path: flag,
    message: `${flag} requiere un valor.`,
    suggestion: `Agrega un valor despues de ${flag}.`,
  };
}

function toCliError(error: unknown): CliError {
  if (isCliError(error)) return error;
  return {
    code: "internal_error",
    message: error instanceof Error ? error.message : "Error desconocido.",
    suggestion: "Revisa el comando y vuelve a ejecutarlo con --json para salida estructurada.",
  };
}

function isCliError(error: unknown): error is CliError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

function formatError(error: CliError): string {
  const pathInfo = error.path ? ` (${error.path})` : "";
  const suggestion = error.suggestion ? ` Sugerencia: ${error.suggestion}` : "";
  return `[${error.code}]${pathInfo} ${error.message}${suggestion}`;
}

function formatHuman(data: unknown): string {
  if (typeof data === "object" && data !== null && "ok" in data) return JSON.stringify(data);
  return JSON.stringify(data, null, 2);
}
