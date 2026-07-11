import type { ApiError } from "@astrocms/contracts";

export class CmsClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "CmsClientError";
  }
}

export interface CmsClientOptions {
  baseUrl: string;
  /** fetch inyectable (SSR/tests). Por defecto el global. */
  fetch?: typeof fetch;
  /** 'include' para enviar cookies (panel). Omitir para SSR público. */
  credentials?: RequestCredentials;
  /** Provee el token CSRF para mutaciones (por defecto lee la cookie en navegador). */
  getCsrfToken?: () => string | undefined;
}

const CSRF_HEADER = "x-csrf-token";

function readCsrfFromDocument(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)astrocms_csrf=([^;]+)/);
  return match?.[1];
}

export function createHttp(opts: CmsClientOptions) {
  const doFetch = opts.fetch ?? fetch;
  const getCsrf = opts.getCsrfToken ?? readCsrfFromDocument;

  return async function request<T>(
    method: string,
    path: string,
    init?: { body?: unknown; query?: Record<string, string | number | undefined> },
  ): Promise<T> {
    const base = opts.baseUrl.replace(/\/$/, "");
    const isAbsolute = /^https?:\/\//.test(base);
    const url = new URL((isAbsolute ? "" : "http://internal") + base + path);
    for (const [k, v] of Object.entries(init?.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const target = isAbsolute ? url.href : url.pathname + url.search;
    const headers: Record<string, string> = { accept: "application/json" };
    const isMutation = method !== "GET";
    const hasBody = init?.body !== undefined;
    const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
    if (hasBody && !isFormData) headers["content-type"] = "application/json";
    if (isMutation) {
      const csrf = getCsrf();
      if (csrf) headers[CSRF_HEADER] = csrf;
    }
    const body = hasBody ? (isFormData ? (init.body as FormData) : JSON.stringify(init.body)) : undefined;
    const res = await doFetch(target, {
      method,
      headers,
      ...(opts.credentials ? { credentials: opts.credentials } : {}),
      ...(body !== undefined ? { body } : {}),
    });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const err = (json as ApiError | undefined)?.error;
      throw new CmsClientError(res.status, err?.code ?? "http_error", err?.message ?? res.statusText, err?.details);
    }
    return json as T;
  };
}
