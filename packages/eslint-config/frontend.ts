import reactHooks from "eslint-plugin-react-hooks";
import eslintReact from "@eslint-react/eslint-plugin";
import { defineConfig } from "eslint/config";
import { baseConfig } from "./base";

export default defineConfig([
  ...baseConfig,
  {
    ignores: ["dist", "build", "node_modules"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "react-hooks": reactHooks as any,
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
