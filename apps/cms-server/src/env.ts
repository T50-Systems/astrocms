import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CMS_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET debe tener ≥16 caracteres"),
  SESSION_TTL: z.coerce.number().int().positive().default(1_209_600),
  PREVIEW_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  MEDIA_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  STORAGE_ROOT: z.string().min(1).default(".astrocms-media"),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:5173"),
  PREVIEW_ORIGIN: z.string().url().default("http://localhost:4321"),
  // SOLO desarrollo: si se define un email, habilita /auth/dev-login (bypass sin contraseña).
  // Ignorado en producción. Dejar vacío desactiva el bypass.
  DEV_AUTOLOGIN: z.string().email().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return parsed.data;
}
