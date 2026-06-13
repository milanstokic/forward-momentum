// @ts-check
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        URL: "readonly",
        console: "readonly",
        process: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // Disable JS rules that conflict with TS
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "*.mjs", "vitest.config.ts"],
  },
];
