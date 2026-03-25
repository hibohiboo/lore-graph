# packages/graph-db

Neo4j クライアントのラッパーパッケージです。接続管理とテストユーティリティを提供します。

## ドライバー管理

[src/driver.ts](src/driver.ts) が Neo4j への接続を管理します。
接続情報は以下の環境変数から取得します。

| 環境変数 | 説明 | 例 |
| --- | --- | --- |
| `NEO4J_URL` | Bolt URI | `bolt://localhost:7687` |
| `NEO4J_USER` | ユーザー名 | `neo4j` |
| `NEO4J_PASSWORD` | パスワード | `neo4jpassword` |

```typescript
import { getDriver } from '@repo/graph-db';

const driver = getDriver(); // 環境変数から自動取得
```

アプリケーション終了時にドライバーは自動クローズされます。

## テストユーティリティ

[test-utils/neo4j-testcontainer.ts](test-utils/neo4j-testcontainer.ts) は Testcontainers を使ったテスト環境セットアップユーティリティです。
`setupGraphDbTestEnv()` を呼ぶと、テスト実行前に Neo4j コンテナが自動起動し、終了後に停止します（タイムアウト: 60秒）。

```typescript
import { setupGraphDbTestEnv } from '../test-utils/neo4j-testcontainer';

const env = setupGraphDbTestEnv({
  beforeSetup: async (driver) => {
    // テスト前の初期データ投入など
  },
});

// テスト内で使用
const driver = env.getDriver();
const { user, password } = env.getCredentials();
```

## スクリプト

```bash
# ローカルの Neo4j Docker を起動（docker/neo4j/bin/up.sh を実行）
bun run local:graphdb

# テスト実行（Testcontainers を使った統合テスト）
bun run test

# lint
bun run lint
```

## 依存関係

| パッケージ | 用途 |
| --- | --- |
| `neo4j-driver` | Neo4j 公式 JS ドライバー |
| `@testcontainers/neo4j` | テスト用 Neo4j コンテナ |
| `testcontainers` | Testcontainers 基盤 |
