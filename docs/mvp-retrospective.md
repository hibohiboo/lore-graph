# MVP 振り返りレポート — lore-graph

作成日: 2026-03-28

---

## 1. 概要

lore-graph は「NPCとの会話を通じて知識グラフを構築する」ナラティブ探索ゲームのプロトタイプ。
プレイヤーがNPCに話しかけると、LLMがNPCとして返答しながら会話内の事実をグラフDBに書き込む、というコアループを実装した。

---

## 2. 作ったもの

### アーキテクチャ全体像

```
[game-client (React)]
       │  POST /api/conversation
       ▼
[backend (Hono)]
  ├── getNpcFacts()       ← Neo4j から既知の事実を取得
  ├── generateNpcReply()  ← LLM で NPC 返答を生成
  ├── extractFacts()      ← LLM で会話から事実を抽出 (JSON mode)
  └── mergeFactsToGraph() ← Neo4j にマージ書き込み
       │
       ▼
[Neo4j (グラフDB)]  ←→  [Ollama (ローカルLLM)]
```

### モノレポ構成

| パッケージ | 役割 |
|---|---|
| `apps/backend` | Hono REST API サーバー |
| `apps/game-client` | React 19 + Vite フロントエンド |
| `packages/graph-db` | Neo4j クライアントラッパー（クエリ・テスト基盤） |
| `packages/schema` | Zod スキーマ（型の単一ソース） |
| `packages/typescript-config` | 共有 tsconfig |
| `packages/eslint-config` | 共有 ESLint 設定 |

---

## 3. 技術選定の判断

### Hono
- エッジ対応で軽量、Bun との相性が良い
- ミドルウェア設計がシンプルで学習コストが低い
- 今回の規模では Fastify 等の重厚なフレームワークは不要と判断

### Neo4j（プロパティグラフDB）
- 「NPCが誰を知っているか」「どの事実を信じているか」という関係性の表現に適している
- RDB では中間テーブルが増えるが、グラフは自然に表現できる
- `BELIEVES` リレーション（確信度・取得日時付き）でNPC視点の知識を管理できる

### OpenAI SDK + Ollama
- 本番はクラウドLLM、開発はローカルOllama に切り替えられる設計（環境変数のみで制御）
- 事実抽出は `response_format: json_object` を使い、LLM出力の構造化を強制

### Zod スキーマを `packages/schema` に分離
- バックエンド・フロントエンド間の型を一元管理
- API境界でのランタイムバリデーションとTypeScript型を同時に得られる

### Testcontainers（Neo4j）
- 統合テストで実際のNeo4jコンテナを起動することで、モックとの乖離を防ぐ
- セットアップ・クリーンアップを `setupGraphDbTestEnv()` に集約

---

## 4. 実装して良かったこと

### グラフモデルの設計
```cypher
(Entity)-[:SUBJECT_OF]->(Fact)-[:OBJECT_OF]->(Entity)
(NPC)-[:BELIEVES {certainty, heardAt}]->(Fact)
```
このモデルにより「誰がいつどの程度の確信で何を信じているか」が自然に表現できた。
事実は共有しつつ、NPCごとの信念は `BELIEVES` リレーションで分離できている点は設計として正解だった。

### LLM の二段構成（返答生成 → 事実抽出）
1本のプロンプトで「返答 + 構造化情報」を同時に取ろうとすると品質が落ちやすい。
「NPCとして返答する」と「会話から事実をJSONで抽出する」を別リクエストに分けたことで、それぞれの品質を独立して調整できる構造になった。

### `npcName` を動的に渡す設計
プロンプトにNPC名を埋め込む設計にしたことで、NPC変更（例: 村の長老 → 酒場の娘）がフロントエンドの1行変更だけで済む。
NPC固有の口調や設定を追加するときも、プロンプトテンプレートを拡張するだけで対応できる。

---

## 5. 苦労したこと・課題

### TypeScript `moduleResolution: NodeNext` の落とし穴
相対インポートに `.js` 拡張子が必須というルールを後から踏んだ。
`.ts` を書いても `.js` を書いても動くが、`NodeNext` では `.js` が必須仕様。
→ **教訓**: `NodeNext` を使うときは最初から `.js` 拡張子でインポートする習慣をつける。

### テスト実行コマンドの混乱
`bun test` と `bun run test` の挙動が異なり、`vitest.config.ts` が読まれないケースがあった。
→ **教訓**: `bun run test`（package.json scripts経由）を使う。

### LLMのJSON出力の安定性
`extractFacts` で `json_object` モードを使っても、モデルによっては空オブジェクトや余分なフィールドが返ることがある。
Zod の `safeParse` でガードしているが、事実が抽出されない無音の失敗が起きやすい。
→ **対策候補**: 抽出失敗時のログ強化、プロンプトのfew-shot例追加。

---

## 6. 今後やること（MVP→α版）

| 優先度 | 内容 |
|---|---|
| 高 | 複数NPC対応（NPC選択UI） |
| 高 | 会話履歴の表示（現状は直前の返答のみ） |
| 中 | グラフの可視化（知識グラフをビジュアルで確認） |
| 中 | NPC固有のペルソナ設定（口調・知識範囲の個別定義） |
| 中 | 事実抽出精度の改善（few-shot、プロンプト調整） |
| 低 | 認証・セッション管理 |
| 低 | デプロイ構成（Docker Compose 完全版） |

---

## 7. 総評

コアコンセプト（会話 → 事実抽出 → グラフ蓄積）の最小実装として、MVPは機能した。
グラフモデルとLLMの二段構成という設計判断は今後も継続して良い。
次の優先事項は「複数NPCと会話履歴」で、ゲームとして成立する最低限のUXを整えること。
