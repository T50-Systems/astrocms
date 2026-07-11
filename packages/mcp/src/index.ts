import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { applyCommand, validateDocument } from "@astrocms/builder-core";
import {
  builderCommandSchema,
  builderDocumentSchema,
  createEntryRequestSchema,
  ErrorCode,
  updateEntryRequestSchema,
  type BlockManifest,
  type BuilderCommand,
  type BuilderDocument,
} from "@astrocms/contracts";
import type { CmsCore } from "@astrocms/cms-core";
import { createCmsCore, DomainError } from "@astrocms/cms-core";
import { contentTypes, createDb, users, type Database } from "@astrocms/cms-database";
import { demoBuilderManifest } from "@astrocms/schemas";

type ToolSuccess<T> = { ok: true; data: T };
type ToolFailure = { ok: false; error: { code: string; message: string; details?: unknown } };
type ToolResult<T> = ToolSuccess<T> | ToolFailure;

interface RuntimeDeps {
  db: Database;
  core: CmsCore;
  manifest: BlockManifest;
  siteId?: string;
  userId?: string;
  close?: () => Promise<unknown>;
}

export interface AstroCmsMcpDeps {
  db?: Database;
  core?: CmsCore;
  manifest?: BlockManifest;
  siteId?: string;
  userId?: string;
  close?: () => Promise<unknown>;
}

const emptyInputSchema = z.object({});
const getEntryInputSchema = z.object({ id: z.string().min(1) });
const queryEntriesInputSchema = z.object({
  contentTypeKey: z.string().min(1).default("page"),
  status: z.enum(["draft", "published", "archived"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
const createPageInputSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^\/[a-z0-9\-/]*$/i, "slug invalido").optional(),
  editorType: z.enum(["rich-text", "markdown", "builder"]).default("builder"),
});
const updateEntryInputSchema = z.object({
  id: z.string().min(1),
  patch: updateEntryRequestSchema,
});
const publishEntryInputSchema = z.object({ id: z.string().min(1) });
const validateDocumentInputSchema = z.object({ document: builderDocumentSchema });
const applyDocumentOpsInputSchema = z.object({
  documentId: z.string().min(1),
  ops: z.array(builderCommandSchema),
});

export type AstroCmsMcpTools = ReturnType<typeof createTools>;

export function createAstroCmsMcpServer(deps: AstroCmsMcpDeps) {
  if (!deps.db && !deps.core) throw new Error("createAstroCmsMcpServer requiere db o core");
  const db = deps.db ?? failMissingDb();
  const core = deps.core ?? createCmsCore({ db });
  const runtime: RuntimeDeps = {
    db,
    core,
    manifest: deps.manifest ?? demoBuilderManifest,
    ...(deps.siteId ? { siteId: deps.siteId } : {}),
    ...(deps.userId ? { userId: deps.userId } : {}),
    ...(deps.close ? { close: deps.close } : {}),
  };
  const tools = createTools(runtime);
  const server = new McpServer(
    { name: "@astrocms/mcp", version: "0.0.0" },
    {
      instructions:
        "Opera AstroCMS como el usuario/rol configurado por el entorno local. No ejecuta codigo arbitrario; solo comandos y documentos validados.",
    },
  );

  registerTools(server, tools);

  return {
    server,
    tools,
    close: async () => {
      await runtime.close?.();
    },
  };
}

export function createAstroCmsMcpServerFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL no definido");
  const conn = createDb(databaseUrl, { max: 3 });
  return createAstroCmsMcpServer({
    db: conn.db,
    close: conn.close,
    manifest: demoBuilderManifest,
    ...(env.ASTROCMS_SITE_ID ? { siteId: env.ASTROCMS_SITE_ID } : {}),
    ...(env.ASTROCMS_USER_ID ? { userId: env.ASTROCMS_USER_ID } : {}),
  });
}

export async function startStdioServer(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const runtime = createAstroCmsMcpServerFromEnv(env);
  const transport = new StdioServerTransport();
  await runtime.server.connect(transport);
}

function createTools(runtime: RuntimeDeps) {
  return {
    get_manifest: withValidation(emptyInputSchema, async () => ok(runtime.manifest)),

    list_content_types: withValidation(emptyInputSchema, async () => {
      const siteId = await resolveSiteId(runtime);
      const rows = await runtime.db.select().from(contentTypes);
      return ok(rows.filter((row) => row.siteId === siteId));
    }),

    query_entries: withValidation(queryEntriesInputSchema, async (input) => {
      const siteId = await resolveSiteId(runtime);
      const data = await runtime.core.entries.list({
        siteId,
        contentTypeKey: input.contentTypeKey,
        query: { page: input.page, pageSize: input.pageSize, ...(input.status ? { status: input.status } : {}) },
      });
      return ok(data);
    }),

    get_entry: withValidation(getEntryInputSchema, async (input) => ok(await runtime.core.entries.get(input.id))),

    create_page: withValidation(createPageInputSchema, async (input) => {
      const siteId = await resolveSiteId(runtime);
      const authorId = await resolveUserId(runtime);
      const data = await runtime.core.entries.create({
        siteId,
        authorId,
        input: createEntryRequestSchema.parse({
          contentTypeKey: "page",
          title: input.title,
          ...(input.slug ? { slug: input.slug } : {}),
          editorType: input.editorType,
        }),
      });
      return ok(data);
    }),

    update_entry: withValidation(updateEntryInputSchema, async (input) => {
      const userId = await resolveUserId(runtime);
      return ok(await runtime.core.entries.update({ id: input.id, userId, input: input.patch }));
    }),

    publish_entry: withValidation(publishEntryInputSchema, async (input) => ok(await runtime.core.entries.publish(input.id))),

    validate_document: withValidation(validateDocumentInputSchema, async (input) => {
      return ok(validateDocument(input.document, runtime.manifest));
    }),

    apply_document_ops: withValidation(applyDocumentOpsInputSchema, async (input) => {
      const userId = await resolveUserId(runtime);
      const original = await runtime.core.builder.get(input.documentId);
      const next = applyOps(original, input.ops);
      const validation = validateDocument(next, runtime.manifest);
      if (!validation.valid) {
        return fail("validation_error", "El documento resultante no cumple el manifiesto.", validation.issues);
      }
      await runtime.core.builder.saveDraft({ id: input.documentId, document: next, userId });
      return ok({ document: next, validation });
    }),
  };
}

function registerTools(server: McpServer, tools: AstroCmsMcpTools): void {
  server.registerTool("get_manifest", {
    description: "Devuelve el BlockManifest activo.",
    inputSchema: emptyInputSchema,
  }, async (input) => mcpResult(await tools.get_manifest(input)));
  server.registerTool("list_content_types", {
    description: "Lista content types del site configurado.",
    inputSchema: emptyInputSchema,
  }, async (input) => mcpResult(await tools.list_content_types(input)));
  server.registerTool("query_entries", {
    description: "Consulta entries paginados por content type.",
    inputSchema: queryEntriesInputSchema,
  }, async (input) => mcpResult(await tools.query_entries(input)));
  server.registerTool("get_entry", {
    description: "Carga un entry por id.",
    inputSchema: getEntryInputSchema,
  }, async (input) => mcpResult(await tools.get_entry(input)));
  server.registerTool("create_page", {
    description: "Crea una pagina usando el usuario configurado.",
    inputSchema: createPageInputSchema,
  }, async (input) => mcpResult(await tools.create_page(input)));
  server.registerTool("update_entry", {
    description: "Actualiza un entry mediante UpdateEntryRequest.",
    inputSchema: updateEntryInputSchema,
  }, async (input) => mcpResult(await tools.update_entry(input)));
  server.registerTool("publish_entry", {
    description: "Publica un entry.",
    inputSchema: publishEntryInputSchema,
  }, async (input) => mcpResult(await tools.publish_entry(input)));
  server.registerTool("validate_document", {
    description: "Valida un BuilderDocument contra el manifiesto.",
    inputSchema: validateDocumentInputSchema,
  }, async (input) => mcpResult(await tools.validate_document(input)));
  server.registerTool("apply_document_ops", {
    description: "Aplica BuilderCommand[] validados y guarda draft si el documento final es valido.",
    inputSchema: applyDocumentOpsInputSchema,
  }, async (input) => mcpResult(await tools.apply_document_ops(input)));
}

function withValidation<TSchema extends z.ZodTypeAny, TData>(
  schema: TSchema,
  handler: (input: z.infer<TSchema>) => Promise<ToolResult<TData>>,
) {
  return async (rawInput: unknown): Promise<ToolResult<TData>> => {
    const parsed = schema.safeParse(rawInput ?? {});
    if (!parsed.success) return fail("validation_error", "Input invalido.", parsed.error.issues);
    try {
      return await handler(parsed.data);
    } catch (error) {
      return normalizeError(error);
    }
  };
}

function applyOps(document: BuilderDocument, ops: BuilderCommand[]): BuilderDocument {
  let next = document;
  for (const op of ops) {
    const parsed = builderCommandSchema.safeParse(op);
    if (!parsed.success) throw new DomainError(ErrorCode.Validation, "BuilderCommand invalido", parsed.error.issues);
    next = applyCommand(next, parsed.data, randomUUID);
  }
  return next;
}

async function resolveSiteId(runtime: RuntimeDeps): Promise<string> {
  if (runtime.siteId) return runtime.siteId;
  runtime.siteId = await runtime.core.resolvePrimarySiteId();
  return runtime.siteId;
}

async function resolveUserId(runtime: RuntimeDeps): Promise<string> {
  if (runtime.userId) return runtime.userId;
  const rows = await runtime.db.select().from(users);
  const user = rows[0];
  if (!user) return failByThrow(ErrorCode.NotFound, "No hay usuarios; ejecuta db:seed antes de operar el MCP.");
  runtime.userId = user.id;
  return user.id;
}

function ok<T>(data: T): ToolSuccess<T> {
  return { ok: true, data };
}

function fail(code: string, message: string, details?: unknown): ToolFailure {
  return { ok: false, error: { code, message, ...(details === undefined ? {} : { details }) } };
}

function failByThrow(code: ErrorCode, message: string): never {
  throw new DomainError(code, message);
}

function normalizeError(error: unknown): ToolFailure {
  if (error instanceof DomainError) return fail(error.code, error.message, error.details);
  if (error instanceof z.ZodError) return fail("validation_error", "Input invalido.", error.issues);
  return fail("internal_error", error instanceof Error ? error.message : "Error desconocido.");
}

function mcpResult(result: ToolResult<unknown>) {
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
    isError: !result.ok,
  };
}

function failMissingDb(): never {
  throw new Error("createAstroCmsMcpServer requiere db cuando core no incluye conexion accesible");
}
