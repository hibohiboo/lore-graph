# 振り返りレポート — lore-graph NPCペルソナ実装（packages/npc-mind 新設）

作成日: 2026-03-29

---

## 1. 概要

NPC の会話品質向上のため、ペルソナ（職業・役割・性格・口調・知識範囲）を DB に永続化し、
LLM プロンプトへ反映する仕組みを実装した。
初期構想の「NPC Mind」層をパッケージとして具体化し、フロントエンドからの管理 UI も追加した。

---

## 2. 作ったもの

### アーキテクチャへの追加

```
[PersonaPanel]
POST /api/personas     ← ペルソナの追加・更新
GET  /api/personas     ← ペルソナ一覧取得
DELETE /api/personas   ← ペルソナ削除
       │
       ▼
[backend: personas.ts]
getAllPersonas / upsertPersona / deletePersona
       │
       ▼
[graph-db: persona.ts]
Neo4j の Persona ノード（name, roles[], personalities[], knowledgeScopes[]）
       │
       ▼（会話時）
[llm.ts] generateNpcReply / generateFactsFromQuestion
       ← ペルソナをプロンプトに組み込む
```

### 新規・変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `packages/npc-mind/` | 新規パッケージ（`NpcPersona` 型を `@repo/schema` から re-export） |
| `packages/schema/src/fact.ts` | `NpcPersonaSchema` / `NpcPersona` 型を追加（配列フィールド） |
| `packages/graph-db/src/persona.ts` | 新規: Neo4j `Persona` ノード CRUD |
| `packages/graph-db/src/index.ts` | persona 関数をエクスポート |
| `apps/backend/src/routes/personas.ts` | 新規: `GET/POST/DELETE /api/personas` |
| `apps/backend/src/index.ts` | `/api/personas` ルートをマウント |
| `apps/backend/src/routes/conversation.ts` | `getPersona` を並列取得し LLM へ渡す |
| `apps/backend/src/services/llm.ts` | ペルソナ引数追加・プロンプト改善・`max_tokens: 512` 追加 |
| `apps/game-client/src/hooks/usePersonaList.ts` | 新規: ペルソナ CRUD hook |
| `apps/game-client/src/components/PersonaPanel.tsx` | 新規: カテゴリ別タグ入力 UI |
| `apps/game-client/src/App.tsx` | `PersonaPanel` を追加 |

### NpcPersona スキーマ

```typescript
{
  name: string,
  roles: string[],           // 職業・役割（複数可）
  personalities: string[],   // 性格・口調（複数可）
  knowledgeScopes: string[], // 知識範囲（複数可）
}
```

---

## 3. 技術選定の判断

### ペルソナを Neo4j の Persona ノードに保存した理由

静的レジストリ（ハードコード）から始めたが、フロントエンドから追加・削除できる要件に変更された。
既存の Neo4j インフラをそのまま活用し、`Persona` ノードとして保存することで永続化・CRUD を実現。

### `NpcPersona` 型を `@repo/schema` に置いた理由

フロントエンドからバックエンドパッケージ（`@repo/graph-db`・`@repo/npc-mind`）を
直接 import することは依存方向として NG。
`@repo/schema` は全パッケージが参照できる中立パッケージのため、ここに型を集約した。

### `generateFactsFromQuestion` にペルソナの「性格・口調」を渡さない設計

事実（Fact）の `objectName` は中立・客観的な文字列である必要がある。
性格・口調をプロンプトに含めると LLM が「若い女性だぜ」のように
語尾込みの `objectName` を生成してしまうことが判明。
→ 事実生成には役割・知識範囲のみ渡し、性格・口調は返答生成（`generateNpcReply`）専用にした。

### 配列プロパティを Neo4j に直接保存

Neo4j はノードプロパティとして配列をネイティブサポートしている。
各アイテムを別ノードにするほどの複雑さは不要と判断し、シンプルに配列プロパティで管理した。

---

## 4. 実装して良かったこと

### 即時反映 UI（更新ボタンなし）

「追加」「削除」を押すたびに即 API を呼び、サーバー状態を正とする設計にした。
ローカル state でフォームを管理してまとめて送信する方式を一度作ったが、
「更新ボタンが不要」という要求でこのシンプルな方式に変更。
結果としてバグの少ない実装になった。

### ペルソナ未登録時のフォールバック

`getPersona` が `undefined` を返した場合、`generateNpcReply` / `generateFactsFromQuestion` は
ペルソナなしの汎用プロンプトにフォールバックする設計にした。
ペルソナを登録していない NPC でも会話が動作し続ける。

### `max_tokens: 512` による応答速度改善

ローカル LLM が長い思考を続けて応答が遅くなる問題に対し、`max_tokens: 512` を全 API 呼び出しに設定。

---

## 5. 苦労したこと・課題

### 語尾がグラフ DB に混入する問題

`generateFactsFromQuestion` にペルソナの「性格・口調」（語尾は「だぜ」など）を渡した結果、
LLM が事実の `objectName` に語尾を混入させた（例: `"若い女性だぜ"`）。

→ 対策：
1. 事実生成プロンプトから「性格・口調」を除外
2. `objectName` は中立的・客観的な表現にする旨のルールを明示

→ **教訓**: プロンプトのコンテキストは渡す情報を絞る。返答生成と事実生成は目的が異なるため、渡すペルソナ要素を分けるべき。

### 「若い女性と知っているのに年齢を答えない」問題

「必ず提供された情報のみを使って答えてください」という制約が強すぎ、
既知情報からの合理的な推測を妨げていた。

→ 「既知の情報から合理的に推測できることは答えてよい」に緩和。
確信度の低い推測は曖昧な表現を使うことで対処。

### 設計の途中変更（静的レジストリ → DB 永続化）

最初に静的 `NPC_REGISTRY`（ハードコード）で実装したが、
「フロントエンドから追加・削除できるようにしたい」という要求変更で DB 永続化に切り替えた。
`packages/npc-mind` の役割も「ペルソナ定義」から「型の re-export」に縮小した。

→ **教訓**: 管理可能にする要件は早期に確認する。静的データで始めた場合でも差し替えやすい設計にしておく。

---

## 6. 今後やること（優先度付き）

| 優先度 | 内容 |
|---|---|
| 高 | **会話履歴の表示**（現状は直前の返答のみ。ゲームとして成立しない） |
| 高 | **複数NPC対応**（NPC選択 UI と複数 NPC のペルソナ管理） |
| 中 | **グラフ可視化**（知識グラフをビジュアルで確認） |
| 低 | 認証・セッション管理 |
| 低 | デプロイ構成（Docker Compose 完全版） |

---

## 7. 設計上の学び（累積追加分）

### 事実生成と返答生成でプロンプトの情報を分ける

LLM に渡すコンテキストは目的ごとに絞る。
- 事実生成（`generateFactsFromQuestion`）→ 役割・知識範囲のみ（口調は不要・有害）
- 返答生成（`generateNpcReply`）→ 役割・性格・口調・知識範囲すべて

### 「必ず〜のみ」制約はグレーゾーンを塞ぎすぎる

LLM への強い制約（「必ず提供された情報のみ使って」）は、
合理的な推測まで封じてしまうことがある。
制約は「何をしてはいけないか」ではなく「どこまで許容するか」の観点で書く。
