import reactHooks from "eslint-plugin-react-hooks";
import eslintReact from "@eslint-react/eslint-plugin";
import { defineConfig } from "eslint/config";
import css from "@eslint/css";
import { baseConfig } from "./base.js";

export default defineConfig([
  ...baseConfig,
  {
    ignores: ["dist", "build", "node_modules"],
  },
   { files: ["**/*.css"], plugins: { css }, language: "css/css", extends: ["css/recommended"],
    rules: {
    "css/no-invalid-properties": ["warn", { allowUnknownVariables: true }],
  } },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "@eslint-react": eslintReact,
    },
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"]
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // AIによる自動リファクタリングを前提とした厳格なルール設定
      "@eslint-react/prefer-read-only-props": "error",
    },
  },
]);
