import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Rocket, Zap } from "lucide-react";
import { loginRequestSchema, type LoginRequest } from "@astrocms/contracts";
import { CmsClientError } from "@astrocms/cms-sdk";
import { useDevLogin, useLogin, useSession } from "../auth.tsx";
import { Alert, errMsg } from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";

// Bypass de desarrollo: sólo en builds de dev de Vite. VITE_DEV_AUTOLOGIN=true → entra solo.
const DEV = import.meta.env.DEV;
const AUTO = import.meta.env.VITE_DEV_AUTOLOGIN === "true";

/** Mensaje legible para el fallo del acceso de desarrollador. */
function devLoginErrMsg(error: unknown): string {
  if (error instanceof CmsClientError && error.status >= 500) {
    return "El acceso de desarrollador no está disponible en este servidor.";
  }
  return errMsg(error);
}

export function LoginPage() {
  const nav = useNavigate();
  const { data: session } = useSession();
  const login = useLogin();
  const devLogin = useDevLogin();
  // Sólo mostramos el error de devLogin si vino de un click manual, no del auto-probe.
  const [manualAttempt, setManualAttempt] = useState(false);
  const { register, handleSubmit, formState } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (session) nav({ to: "/" });
  }, [session, nav]);

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
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader className="items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Zap className="size-5" />
          </div>
          <CardTitle className="text-xl tracking-tight">Iniciar sesión</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {login.isError && <Alert>{errMsg(login.error)}</Alert>}
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" aria-invalid={Boolean(formState.errors.email)} {...register("email")} />
              {formState.errors.email?.message && <p className="text-xs text-destructive">{formState.errors.email.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(formState.errors.password)} {...register("password")} />
              {formState.errors.password?.message && <p className="text-xs text-destructive">{formState.errors.password.message}</p>}
            </div>
            <Button type="submit" disabled={login.isPending}>{login.isPending ? "Entrando…" : "Entrar"}</Button>
          </form>

          {DEV && (
            <div className="mt-2 flex flex-col gap-2 border-t border-dashed pt-4">
              {manualAttempt && devLogin.isError && <Alert>{devLoginErrMsg(devLogin.error)}</Alert>}
              <Button variant="outline" type="button" disabled={devLogin.isPending}
                onClick={() => { setManualAttempt(true); devLogin.mutate(undefined, { onSuccess: () => nav({ to: "/" }) }); }}>
                <Rocket className="size-4" />
                {devLogin.isPending ? "Entrando…" : "Entrar como desarrollador"}
              </Button>
              <p className="text-xs text-muted-foreground">Sólo desarrollo. Requiere DEV_AUTOLOGIN en el servidor. Nunca en producción.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
