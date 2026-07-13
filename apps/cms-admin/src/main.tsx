import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import { queryClient } from "./lib.ts";
import { router } from "./router.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("#root no encontrado");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

// Retira el splash tras el primer frame pintado (doble rAF ≈ primer paint real).
queueMicrotask(() =>
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const s = document.getElementById("splash");
      if (s) {
        s.classList.add("done");
        setTimeout(() => s.remove(), 250);
      }
    }),
  ),
);
