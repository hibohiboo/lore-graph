# 振り返りレポート — lore-graph (Fact-first + シードデータ登録)

作成日: 2026-03-29

---

## 1. 概要

NPCとの会話を通じて知識グラフを構築するナラティブ探索ゲームのプロトタイプ。
今回のセッションでは2つのフェーズを完了した：
1. **Fact-first アーキテクチャ移行**：NPC の hallucination によるグラフ汚染を防ぐ
2. **世界設定シードデータ登録機能**：自由記述テキストから facts を生成しグラフに保存

---

## 2. 作ったもの

### 現在のアーキテクチャ

```
[SeedPanel (React)]
    │ POST /api/seed { text }
    ▼
[backend: seed.ts]
    └─→ extractFactsFromText()   ← LLMが自由記述から事実を抽出
    └─→ mergeFactsToGraph("世界設定", facts)  ← 共有知識として保存

[ConversationPanel (React)]
    │ POST /api/conversation { npcName, playerMessage }
    ▼
[backend: conversation.ts]
    ├─→ getNpcFacts(npcName)      ← NPC固有の事実
    ├─→ getNpcFacts("世界設定")   ← 世界共有の事実（追加）
    ├─→ generateFactsFromQuestion()  ← 質問から新規事実を先に確定
    ├─→ mergeFactsToGraph(npcName, newFacts)
    └─→ generateNpcReply()        ← 保存済みfactsのみで返答生成
    ▼
[Neo4j] ←→ [Ollama / OpenAI]
```

### モノレポ構成

| パッケージ | 役割 | 主な変更 |
|---|---|---|
| `apps/backend` | Hono REST API | `/api/seed` 追加、会話フロー変更 |
| `apps/game-client` | React + Vite フロントエンド | SeedPanel 追加、Zod バリデーション導入 |
| `packages/graph-db` | Neo4j クライアント | certainty 取得、Zod バリデーション導入 |
| `packages/schema` | Zod スキーマ（共有型） | predicate を `z.string()` に戻す |

---

## 3. 技術選定の判断

### `"世界設定"` という仮想 NPC でシードを管理
グラフモデル（`NPC -[:BELIEVES]-> Fact`）を変えずに世界共有情報を表現するため、
特別な NPC 名 `"世界設定"` の BELIEVES として保存する設計を選択。
会話時に `getNpcFacts("世界設定")` を並列で取得して合成することで、
全 NPC が世界設定を参照できる構造になっている。

### API レスポンスの Zod バリデーション（フロントエンド）
`res.json() as Promise<T>` による型アサーションを廃止し、
`@repo/schema` の `ExtractedFactSchema` を `z.infer<>` で共有。
バックエンドとフロントエンドが同一の Zod スキーマを使うことで、
API 境界での型の保証を実現した。

### Neo4j レコードの Zod バリデーション
`r.get(...) as string` による型アサーションを廃止し、
`NpcFactRecordSchema.safeParse()` で検証。
パース失敗レコードは `flatMap` で除外し、型安全性と堅牢性を両立。

---

## 4. 実装して良かったこと

### Fact-first フロー
NPC が喋ってから事実を抽出する構造から、事実を先に確定してから NPC が喋る構造へ変更。
`llm-debug.log` で確認できるようになり、hallucination がグラフに入らなくなった。

### プレースホルダーフィルタの三重防衛
`generateFactsFromQuestion` への入力・`parseFacts` の出力・`generateNpcReply` への入力
の3箇所で `PLACEHOLDER_PATTERN` を適用。どのステージで `"不明"` が混入しても遮断できる。

### `warning` フィールドによるソフトエラー
シード登録で事実が0件の場合に HTTP 200 + `warning` フィールドを返す設計。
フロントエンドはオレンジ色で警告を表示し、入力テキストをクリアしないため再入力しやすい。
HTTP エラーと「抽出できなかった」を区別できる。

### Zod スキーマの一元管理
`@repo/schema` の `ExtractedFactSchema` をバックエンド・フロントエンド両方で使用。
型定義の重複がなく、スキーマ変更時の修正が一箇所で済む。

---

## 5. 苦労したこと・課題

### LLM が few-shot 例なしでは単純な事実も抽出できない
「酒場の娘の名前はリン」のような明確な文でも、プロンプトに例がないと `{"facts":[]}` を返すことがある。
few-shot 例（名前・場所・伝聞の3パターン）を追加することで改善した。
→ **教訓**: ローカルモデルは few-shot なしではルールだけでは動かない。具体例が必須。

### LLM の predicate 非遵守（前回から継続）
`json_schema` の `strict: true` + enum 制約を設定しても `is_part_of` 等を返すことがある。
`PREDICATE_MAP` による正規化と `related_to` へのフォールバックで対処。
→ `parseFacts - FALLBACK` ログで追跡可能。

### プレースホルダー値 `"不明"` のグラフ汚染（前回から継続）
モデルが `objectName: "不明"` を返しグラフに保存されてしまう問題。
`parseFacts` での出力フィルタに加え、`generateNpcReply` への入力フィルタも追加して完全遮断。

### certainty が NPC 返答に反映されていなかった
Cypher クエリで `BELIEVES` リレーションに `b` エイリアスを付与し忘れたため Neo4j 構文エラー。
`-[:BELIEVES]->` → `-[b:BELIEVES]->` に修正。

### `as` 型アサーションの散在
`res.json() as Promise<T>` や `r.get(...) as string` による型ごまかしが複数箇所に存在。
Zod `parse` / `safeParse` に統一し、実行時に型が保証される設計に修正。

---

## 6. 今後やること（優先度付き）

| 優先度 | 内容 |
|---|---|
| 高 | **会話履歴の表示**（現状は直前の返答のみ。ゲームとして成立しない） |
| 高 | **複数NPC対応**（NPC選択UI。現状は酒場の娘固定） |
| 中 | **NPC固有ペルソナ設定**（口調・知識範囲の個別定義） |
| 中 | **グラフ可視化**（知識グラフをビジュアルで確認） |
| 中 | **世界設定の一覧・削除UI**（登録済みシードを管理できるエンドポイント） |
| 低 | 認証・セッション管理 |
| 低 | デプロイ構成（Docker Compose 完全版） |

---

## 7. 設計上の学び（今回追加）

### API 境界は必ず Zod で検証する
フロントエンドからバックエンドへのレスポンス、Neo4j からのレコード取得など、
外部からのデータはすべて `safeParse` / `parse` を通す。
`as T` は「そうである保証がない」ため、型安全性を損なう。

### ソフトエラーと HTTP エラーを分ける
「処理は成功したが結果が空」と「サーバーエラー」は性質が異なる。
前者は `warning` フィールドで表現し、後者は 4xx/5xx で返すことで
クライアント側が適切にハンドリングできる。

### few-shot 例はドキュメントではなく仕様
LLM に対して「predicateはXを使え」と書いても守られないが、
「この入力にはこの出力を返せ」という具体例は高い確率で遵守される。
プロンプトエンジニアリングにおいて few-shot は必須の要素。
