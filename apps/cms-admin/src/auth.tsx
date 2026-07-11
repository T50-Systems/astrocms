import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@astrocms/contracts";
import { CmsClientError } from "@astrocms/cms-sdk";
import { cms } from "./lib.ts";

/** Sesión actual. `null` si no autenticado (401). */
export function useSession() {
  return useQuery<Session | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await cms.auth.me();
      } catch (err) {
        if (err instanceof CmsClientError && err.status === 401) return null;
        throw err;
      }
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => cms.auth.login(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

/** Bypass de desarrollo: inicia sesión sin contraseña (sólo si el servidor lo habilita). */
export function useDevLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cms.auth.devLogin(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cms.auth.logout(),
    onSuccess: () => qc.setQueryData(["me"], null),
  });
}

export function can(session: Session | null | undefined, permission: string): boolean {
  return Boolean(session?.permissions.includes(permission));
}
