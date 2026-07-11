import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { loginRequestSchema, type LoginRequest } from "@astrocms/contracts";
import { useDevLogin, useLogin, useSession } from "../auth.tsx";
import { Button, ErrorBox, Field, inputStyle, Page } from "../ui.tsx";

// Bypass de desarrollo: sólo en builds de dev de Vite. VITE_DEV_AUTOLOGIN=true → entra solo.
const DEV = import.meta.env.DEV;
const AUTO = import.meta.env.VITE_DEV_AUTOLOGIN === "true";

export function LoginPage() {
  const nav = useNavigate();
  const { data: session } = useSession();
  const login = useLogin();
  const devLogin = useDevLogin();
  const { register, handleSubmit, formState } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (session) nav({ to: "/" });
  }, [session, nav]);

  // Auto-login en desarrollo si está activado (bypass total).
  useEffect(() => {
    if (DEV && AUTO && !session && devLogin.isIdle) {
      devLogin.mutate(undefined, { onSuccess: () => nav({ to: "/" }) });
    }
  }, [session, devLogin, nav]);

  const onSubmit = handleSubmit(async (values) => {
    await login.mutateAsync(values);
    nav({ to: "/" });
  });

  return (
    <Page>
      <h1>Iniciar sesión</h1>
      {login.isError && <ErrorBox error={login.error} />}
      <form onSubmit={onSubmit} noValidate>
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <input id="email" type="email" autoComplete="username" style={inputStyle} {...register("email")} />
        </Field>
        <Field label="Contraseña" htmlFor="password" error={formState.errors.password?.message}>
          <input id="password" type="password" autoComplete="current-password" style={inputStyle} {...register("password")} />
        </Field>
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      {DEV && (
        <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px dashed #ccc" }}>
          {devLogin.isError && <ErrorBox error={devLogin.error} />}
          <Button
            ghost
            type="button"
            disabled={devLogin.isPending}
            onClick={() => devLogin.mutate(undefined, { onSuccess: () => nav({ to: "/" }) })}
          >
            {devLogin.isPending ? "Entrando…" : "🚀 Entrar como desarrollador (sin contraseña)"}
          </Button>
          <p style={{ color: "#999", fontSize: "0.8rem", marginTop: "0.4rem" }}>
            Sólo desarrollo. Requiere DEV_AUTOLOGIN en el servidor. Nunca en producción.
          </p>
        </div>
      )}
    </Page>
  );
}
