import { QueryClient } from "@tanstack/react-query";
import { createCmsClient } from "@astrocms/cms-sdk";

/** Same-origin gracias al proxy de Vite → cookies HttpOnly + CSRF funcionan. */
export const cms = createCmsClient({ baseUrl: "/api/v1", credentials: "include" });

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
