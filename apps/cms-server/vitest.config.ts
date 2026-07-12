import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Los tests de integración comparten un único Postgres y el usuario admin
    // (logout-all revoca TODAS sus sesiones): ejecutar archivos en paralelo
    // provoca 401 intermitentes por carrera. Secuencial = determinista.
    fileParallelism: false,
  },
});
