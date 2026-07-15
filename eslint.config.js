import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.astro/**",
      "**/node_modules/**",
      "**/*.d.ts",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "packages/cms-database/drizzle/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // calibrado F0: usos puntuales de any no son el foco de este incremento.
      "@typescript-eslint/no-explicit-any": "off",
      // calibrado F0: estos avisos no deben bloquear la adopción inicial.
      "no-empty": "warn",
      "no-constant-condition": "warn",
      "prefer-const": "warn",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["apps/cms-admin/**/*.{ts,tsx}", "packages/builder-react/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
