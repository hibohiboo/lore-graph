# 振り返りレポート — lore-graph (Fact-first + シード管理 + Fact一覧削除)

作成日: 2026-03-29

---

## 1. 概要

NPCとの会話を通じて知識グラフを構築するナラティブ探索ゲームのプロトタイプ。
今回のセッションでは3フェーズを完了した：
1. **Fact-first アーキテクチャ移行**：NPC の hallucination によるグラフ汚染を防止
2. **世界設定シードデータ登録・管理**：自由記述テキストから facts を抽出し、一覧・削除も可能に
3. **Fact 一覧・完全削除**：グラフ全体の facts を確認し、不要なものを完全削除できる管理機能

---

## 2. 作ったもの

### 現在のアーキテクチャ

```
[SeedPanel]         [FactListPanel]      [ConversationPanel]
POST /api/seed      GET /api/facts       POST /api/conversation
GET  /api/seed      DELETE /api/facts
DELETE /api/seed
       │                  │                      │
       ▼                  ▼                      ▼
[backend: seed.ts]  [backend: facts.ts]  [backend: conversation.ts]
extractFactsFromText  getAllFacts()        getNpcFacts(npcName)
mergeFactsToGraph     hardDeleteFact()    getNpcFacts("世界設定")
("世界設定", facts)                       generateFactsFromQuestion()
                                          mergeFactsToGraph(npcName)
                                          generateNpcReply()
              │                  │                │
              └──────────────────┴────────────────┘
                                 │
                            [Neo4j] ←→ [Ollama / OpenAI]
```

### API エンドポイント一覧

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/api/conversation` | NPC との会話（Fact-first フロー） |
| `POST` | `/api/seed` | 自由記述テキストから世界設定を登録 |
| `GET` | `/api/seed` | 世界設定 facts の一覧取得 |
| `DELETE` | `/api/seed` | 世界設定の BELIEVES リレーション削除（soft） |
| `GET` | `/api/facts` | グラフ全体の facts 一覧取得 |
| `DELETE` | `/api/facts` | Fact ノードと全リレーションを完全削除（hard） |

### モノレポ構成

| パッケージ | 役割 | 主な追加・変更 |
|---|---|---|
| `apps/backend` | Hono REST API | `/api/facts` 追加 |
| `apps/game-client` | React + Vite | `FactListPanel`・`useFactList` 追加 |
| `packages/graph-db` | Neo4j クライアント | `getAllFacts`・`hardDeleteFact`・`deleteNpcFact` 追加 |
| `packages/schema` | Zod 共有スキーマ | 変更なし |

---

## 3. 技術選定の判断

### soft delete と hard delete の分離

削除の意味が2種類あるため、エンドポイントを分けた：

| | エンドポイント | Cypher | 用途 |
|---|---|---|---|
| soft | `DELETE /api/seed` | `DELETE b`（BELIEVES のみ） | 世界設定から外す（Fact は残る） |
| hard | `DELETE /api/facts` | `DETACH DELETE f`（Fact ノード全体） | グラフから完全消去 |

`DETACH DELETE` により、Fact に紐づく全リレーション（`SUBJECT_OF`・`OBJECT_OF`・全 NPC の `BELIEVES`）を一括削除できる。

### `FactRecord` 型の graph-db 内定義と export

`getAllFacts` の戻り値型 `FactRecord` を `@repo/graph-db` からエクスポートし、バックエンド・フロントエンド共通の型として共有できる設計にした（ただし現状フロントエンド側は `useFactList.ts` 内で独自定義）。

### API 境界の Zod 一元化

全フック（`useConversation`・`useSeed`・`useFactList`）で `res.json()` の結果を Zod スキーマで `parse` し、型アサーション (`as`) を完全排除した。Neo4j のレコード取得（`r.get(...)`）も同様に `safeParse` で検証。

---

## 4. 実装して良かったこと

### warning フィールドによるソフトエラー
`POST /api/seed` で事実が0件のとき HTTP 200 + `warning` フィールドを返す設計。
フロントエンドはオレンジで表示し、入力テキストをクリアしないため再入力しやすい。HTTP エラーと「抽出できなかった」を区別できる。

### `useEffect` + `fetchWorldFacts` による自動更新
登録・削除後に `fetchWorldFacts()` を呼ぶことで、一覧が常に最新状態に保たれる。
React の `useCallback` で関数を安定させ、`useEffect` の依存配列に安全に渡せる設計にした。

### `flatMap` でバリデーション失敗レコードを除外
`getNpcFacts`・`getAllFacts` ともに `safeParse` 失敗時は `flatMap` で空配列を返してスキップ。
例外を throw せず、取得できたレコードだけを返す堅牢な実装になった。

### `indexOf` による certainty ラベル除去
`" (certainty:X.X)"` の除去を正規表現の代わりに `indexOf + slice` で実装。
`sonarjs/slow-regex`（ReDoS 警告）を回避できた。

---

## 5. 苦労したこと・課題

### LLM が few-shot なしでは単純な事実も抽出できない
「酒場の娘の名前はリン」のような明確な文でも `{"facts":[]}` を返すことがある。
few-shot 例（名前・場所・伝聞の3パターン）を追加することで改善した。
→ **教訓**: ローカルモデルはルール記述だけでは動かない。具体例が必須。

### LLM の predicate 非遵守（継続課題）
`json_schema` の `strict: true` + enum 制約を設定しても非標準 predicate を返すことがある。
`PREDICATE_MAP` による正規化と `related_to` へのフォールバックで対処。
`parseFacts - FALLBACK` ログで追跡可能。

### プレースホルダー値 `"不明"` のグラフ汚染
モデルが `objectName: "不明"` を返し保存されてしまう問題。入力・出力・NPC返答の3箇所で `PLACEHOLDER_PATTERN` フィルタを適用して完全遮断。

### `BELIEVES` エイリアス漏れによる Neo4j 構文エラー
`-[:BELIEVES]->` でエイリアスなしに `b.certainty` を参照してエラー。`-[b:BELIEVES]->` で修正。
→ **教訓**: Cypher でリレーションのプロパティを使うときはエイリアスが必須。

### `sonarjs/slow-regex` 警告
`/\s*\(certainty:[^)]+\)$/` が ReDoS 脆弱性として検出された。
`indexOf + slice` で代替し、lint エラーを解消。

---

## 6. 今後やること（優先度付き）

| 優先度 | 内容 |
|---|---|
| 高 | **会話履歴の表示**（現状は直前の返答のみ。ゲームとして成立しない） |
| 高 | **複数NPC対応**（NPC選択 UI。現状は酒場の娘固定） |
| 中 | **NPC固有ペルソナ設定**（口調・知識範囲の個別定義） |
| 中 | **グラフ可視化**（知識グラフをビジュアルで確認） |
| 低 | 認証・セッション管理 |
| 低 | デプロイ構成（Docker Compose 完全版） |

---

## 7. 設計上の学び（累積）

### API 境界は必ず Zod で検証する
`res.json() as T` は「そうである保証がない」。`@repo/schema` の Zod スキーマをフロントエンド・バックエンドで共有し、実行時に型を保証する。

### ソフトエラーと HTTP エラーを分ける
「処理は成功したが結果が空」と「サーバーエラー」は性質が異なる。前者は `warning` フィールドで表現し、クライアントが適切にハンドリングできる設計にする。

### few-shot 例はドキュメントではなく仕様
LLM に対してルールを書いても守られないが、具体的な入出力ペアは高い確率で遵守される。プロンプトエンジニアリングにおいて few-shot は必須の要素。

### 削除の意味を明確に分ける
「関係を切る（soft delete）」と「ノードごと消す（hard delete）」は別のエンドポイントにする。用途・影響範囲が異なるため、同じ DELETE に混在させない。
