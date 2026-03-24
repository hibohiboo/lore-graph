---
title: "Bun + Turbo モノレポで作る フロントエンド/バックエンド統合構成のスタンダード"
tags:
  - Bun
  - Turborepo
  - TypeScript
  - Hono
  - React
private: false
---

## はじめに

フロントエンドとバックエンドを別リポジトリで管理していると、型定義や ESLint・TypeScript の設定が重複し、依存関係の更新も二重になりがちになる。

今回は **Bun + Turborepo** をベースにしたモノレポ構成をまとめておく。
共有パッケージで設定を一元管理しつつ、フロントエンド（React 19 + Vite）とバックエンド（Hono）を分離した構成となる。

## ディレクトリ構成

```
my-app/
├── apps/
│   ├── backend/          # Hono.js API サーバー
│   └── frontend/         # React 19 + Vite
├── packages/
│   ├── eslint-config/    # 共有 ESLint 設定
│   └── typescript-config/# 共有 TypeScript 設定
├── package.json          # ルート（ワークスペース定義）
├── turbo.json            # Turbo タスクパイプライン
└── bun.lock
```

`apps/` には実際に動くアプリケーション、`packages/` には各アプリが参照する共有設定を配置。

## 使用技術スタック

| カテゴリ | 技術 | バージョン |
|---|---|---|
| ランタイム / パッケージマネージャー | Bun | 1.3.11 |
| モノレポ管理 | Turborepo | ^2.8.20 |
| バックエンドフレームワーク | Hono | ^4.12.9 |
| フロントエンドフレームワーク | React | ^19.2.4 |
| フロントエンドビルドツール | Vite | ^8.0.2 |
| 言語 | TypeScript | ^6.0.2 |
| Linter | ESLint | ^10.1.0（Flat Config）|
| フォーマッター | Prettier | ^3.8.1 |

## ルート設定

### `package.json`

```json
{
  "name": "my-app",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.3.11",
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "devDependencies": {
    "prettier": "^3.8.1",
    "turbo": "^2.8.20",
    "typescript": "^6.0.2"
  }
}
```

`workspaces` で `packages/*` と `apps/*` を宣言することで、Bun がモノレポ内の依存解決を自動的に行い、`@repo/eslint-config` のようなローカルパッケージを `"*"` で参照できるようになる。

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {},
    "lint": {
      "dependsOn": ["^lint"]
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

`dependsOn: ["^lint"]` は「依存パッケージの lint が先に通ってから自分の lint を実行する」という意味。
`dev` は `cache: false` かつ `persistent: true` にすることで、ホットリロードが正しく動作するようになる。

## 共有パッケージ

### TypeScript 設定（`packages/typescript-config`）

`package.json` の `exports` フィールドで用途別に提供。

```json
{
  "name": "@repo/typescript-config",
  "exports": {
    "./base.json": "./base.json",
    "./frontend.json": "./frontend.json"
  }
}
```

**`base.json`**（バックエンド・Node.js 向け）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["es2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

**`frontend.json`**（React + Vite 向け）

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true
  }
}
```

バックエンドは `NodeNext`、フロントエンドは `bundler` モードで `moduleResolution` を分けるのがポイント。

### ESLint 設定（`packages/eslint-config`）

ESLint v10 の Flat Config を前提に、ベース設定とフロントエンド設定を分離する。

```json
{
  "name": "@repo/eslint-config",
  "exports": {
    "./base": "./base.js",
    "./frontend": "./frontend.js"
  }
}
```

**`base.js`**

```js
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import sonarjs from "eslint-plugin-sonarjs";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import unusedImports from "eslint-plugin-unused-imports";

export const baseConfig = defineConfig([
  {
    ...sonarjs.configs.recommended,
    files: ["**/*.{js,ts,tsx}"],
  },
  {
    files: ["**/*.{js,ts,tsx}"],
    plugins: { js, "unused-imports": unusedImports },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  eslintConfigPrettier,
]);

export default baseConfig;
```

**`frontend.js`**

```js
import reactHooks from "eslint-plugin-react-hooks";
import eslintReact from "@eslint-react/eslint-plugin";
import { defineConfig } from "eslint/config";
import css from "@eslint/css";
import { baseConfig } from "./base.js";

export default defineConfig([
  ...baseConfig,
  { ignores: ["dist", "build", "node_modules"] },
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "@eslint-react": eslintReact,
    },
    languageOptions: {
      parserOptions: { project: ["./tsconfig.json"] },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "sonarjs/prefer-read-only-props": "error",
    },
  },
]);
```

`sonarjs/prefer-read-only-props` で React の props を読み取り専用として強制している。

## バックエンド（`apps/backend`）

### `package.json`

```json
{
  "name": "@app/backend",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "lint": "eslint . --fix"
  },
  "dependencies": {
    "hono": "^4.12.9"
  },
  "devDependencies": {
    "@repo/eslint-config": "*",
    "@repo/typescript-config": "*",
    "@types/bun": "latest"
  }
}
```

`bun run --hot` で TypeScript ファイルをそのまま実行しながらホットリロード。
コンパイルステップ不要なのが Bun の強み。

### `tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  }
}
```

`jsxImportSource: "hono/jsx"` を指定することで、Hono の JSX ランタイムを使ったサーバーサイドレンダリングが可能になる。利用しないかもしれないが、honoのcreateを使うと設定されているのでそのままにした。

### `eslint.config.js`

```js
import config from "@repo/eslint-config/base";
export default config;
```

### エントリポイント（`src/index.ts`）

```ts
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

export default app;
```

## フロントエンド（`apps/frontend`）

### `package.json`

```json
{
  "name": "@app/frontend",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint . --fix",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  },
  "devDependencies": {
    "@repo/eslint-config": "*",
    "@repo/typescript-config": "*",
    "@vitejs/plugin-react": "^6.0.1",
    "@rolldown/plugin-babel": "^0.2.2",
    "babel-plugin-react-compiler": "^1.0.0",
    "vite": "^8.0.2",
    "typescript": "~6.0.2"
  }
}
```

### `vite.config.ts`

```ts
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
```

`babel-plugin-react-compiler` を使うことで、React 19 のコンパイラによる自動メモ化が有効になる。
`useMemo` や `useCallback` を手書きする必要がなくなる。

### `tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/frontend.json",
  "compilerOptions": {
    "strictNullChecks": true
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### `eslint.config.js`

```js
import config from "@repo/eslint-config/frontend";
export default config;
```

## セットアップ手順

```bash
# リポジトリを作成
mkdir my-app && cd my-app
git init

# Bun の初期化
bun init -y

# Turbo のインストール
bun add -d turbo

# ワークスペースの作成
mkdir -p apps/backend apps/frontend packages/eslint-config packages/typescript-config

# 各アプリを Bun で初期化
cd apps/backend && bun init -y && cd ../..
cd apps/frontend && bun init -y && cd ../..
```

ルートの `package.json` にワークスペース設定を追加した後:

```bash
# 全依存関係をインストール
bun install

# 開発サーバー起動（フロント・バック同時）
bun run dev

# 全パッケージの lint 実行
bun run lint
```

## この構成のメリット

### 1. 設定の一元管理
TypeScript と ESLint の設定を `packages/` に集約。ルールの追加・変更が一箇所で済む。

### 2. Turbo によるキャッシュとタスク並列化
`turbo run lint` は変更のないパッケージをキャッシュからスキップする。

### 3. Bun による高速な開発体験
- インストール速度が npm / pnpm より大幅に速い
- バックエンドはコンパイルなしで TypeScript を直接実行
- `bun run --hot` でホットリロード

### 4. React Compiler による自動最適化
`babel-plugin-react-compiler` により、手動の `useMemo` / `useCallback` が不要になる。React 19 以降のスタンダードなアプローチ。

### 5. 最新の ESLint Flat Config
v9 以降の Flat Config 形式で設定を記述。従来の `.eslintrc` よりシンプルかつ型安全に設定できます。

## まとめ

| 要素 | 選択 | 理由 |
|---|---|---|
| パッケージマネージャー | Bun | 高速インストール・TS 直接実行 |
| モノレポ管理 | Turbo | キャッシュ・タスク依存管理 |
| バックエンド | Hono | 軽量・型安全・Bun ネイティブ |
| フロントエンド | React 19 + Vite | 最新 React エコシステム |
| 共有設定 | `packages/` | 設定の DRY 化 |

# 注意

typescript6にeslint-typescriptが2026.03.25時点で未対応。
下記の警告が出る。エラーにはならないので放置している。

```
$ bun run lint
$ eslint . --fix
=============


WARNING: You are currently running a version of TypeScript which is not officially supported by @typescript-eslint/typescript-estree.


* @typescript-eslint/typescript-estree version: 8.57.2
* Supported TypeScript versions: >=4.8.4 <6.0.0
* Your TypeScript version: 6.0.2


Please only submit bug reports when using the officially supported version.


=============
```
