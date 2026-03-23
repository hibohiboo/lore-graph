import reactHooks from "eslint-plugin-react-hooks";
import eslintReact from "@eslint-react/eslint-plugin";
import { defineConfig } from "eslint/config";
import { baseConfig } from "./base";

export default defineConfig([
  ...baseConfig,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "react-hooks": reactHooks as any,
      "@eslint-react": eslintReact,
    },
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // @eslint-react のルールを適用
      "@eslint-react/hooks-extra/no-unnecessary-use-state": "warn",
      "@eslint-react/naming-convention/filename": ["error", "kebab-case"],
      // AIによる自動リファクタリングを前提とした厳格なルール設定
      "@eslint-react/prefer-read-only-props": "error",
    },
  },
]);
