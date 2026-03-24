import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import sonarjs from 'eslint-plugin-sonarjs';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export const baseConfig = defineConfig([
  { ...sonarjs.configs.recommended, files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"] },
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended,
  eslintConfigPrettier,
]);
