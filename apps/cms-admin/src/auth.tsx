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
    onSuccess: () => {
      setExplicitLogout(false);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

/** Bypass de desarrollo: inicia sesión sin contraseña (sólo si el servidor lo habilita). */
export function useDevLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cms.auth.devLogin(),
    onSuccess: () => {
      setExplicitLogout(false);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

/**
 * Marca "el usuario salió a propósito" (sessionStorage). El auto-login de
 * desarrollo (VITE_DEV_AUTOLOGIN) la respeta: sin esto, Salir revoca la sesión
 * pero el login vuelve a entrar solo y parece que Salir no funciona.
 */
const LOGGED_OUT_KEY = "astrocms-logged-out";

export function setExplicitLogout(value: boolean) {
  try {
    if (value) sessionStorage.setItem(LOGGED_OUT_KEY, "1");
    else sessionStorage.removeItem(LOGGED_OUT_KEY);
  } catch {
    // sessionStorage puede no estar disponible; el auto-login es solo una comodidad.
  }
}

export function wasExplicitLogout(): boolean {
  try {
    return sessionStorage.getItem(LOGGED_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cms.auth.logout(),
    onSuccess: () => {
      setExplicitLogout(true);
      qc.setQueryData(["me"], null);
    },
  });
}

export function can(session: Session | null | undefined, permission: string): boolean {
  return Boolean(session?.permissions.includes(permission));
}
