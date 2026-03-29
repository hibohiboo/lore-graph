# 振り返りレポート — lore-graph (Fact-first アーキテクチャ改善)

作成日: 2026-03-29

---

## 1. 概要

NPCとの会話を通じて知識グラフを構築するナラティブ探索ゲームのプロトタイプ。
前回MVPから「Fact-first アーキテクチャ」へ移行し、NPC の hallucination によるグラフ汚染を防ぐコアループの品質改善を行った。

---

## 2. 今回やったこと

### アーキテクチャ変更：Fact-first フロー

**Before（MVP時）:**
```
既存facts取得 → NPC返答生成（hallucination可） → facts抽出（返答から） → 保存
```

**After（今回）:**
```
既存facts取得 → generateFactsFromQuestion（先にfact確定） → 保存 → NPC返答生成（grounded）
```

NPC が「自由に喋ってから facts を抽出」する構造から、「facts を先に確定してから NPC が喋る」構造に変更。

### 主な変更ファイル

| ファイル | 変更内容 |
|---|---|
| `apps/backend/src/services/llm.ts` | `generateFactsFromQuestion()` 追加、プロンプト改善、デバッグログ追加 |
| `apps/backend/src/routes/conversation.ts` | Fact-first フローに変更、`extractFacts` 廃止 |
| `packages/graph-db/src/npc-facts.ts` | certainty を取得し、0.8未満は文字列に `(certainty:X.X)` 付与 |
| `packages/schema/src/fact.ts` | predicate を `z.string()` に戻す（enum 廃止） |
| `apps/game-client/src/hooks/useConversation.ts` | `extractedFacts` → `newFacts` に変更 |
| `apps/game-client/src/components/ConversationPanel.tsx` | 表示ラベルを「新たに判明したFact」に変更 |

---

## 3. 苦労したこと・課題

### LLM の predicate 非遵守問題
プロンプトで predicate の enum を指定しても、ローカルモデル（qwen2.5:7b）が `is_part_of`・`is_name_of` など独自の形式を返し続けた。

対策：
- Zod `z.enum` → `z.string()` に戻し、パース自体を通す
- `PREDICATE_MAP` で既知の非標準 predicate を正規化
- 正規化できない場合は `related_to` にフォールバック（ログに記録）
- `response_format: json_schema` with `strict: true` + enum で API レベルでも制約

### プレースホルダー値の汚染
`generateFactsFromQuestion` が `{"objectName": "不明", "certainty": 0.0}` を返し、グラフに保存されて NPC が「わかりません」と答え続ける悪循環が発生。

対策：
- `parseFacts()` で objectName に `PLACEHOLDER_PATTERN`（不明・？・未定等）が含まれる fact を破棄
- `generateNpcReply()` でも既存 facts からプレースホルダーを除外
- `generateFactsFromQuestion()` に渡す既存 facts もプレースホルダーを除外（ブロック防止）

### 自己参照の質問に答えられない
「あなたの名前は？」「住んでいる町は？」のような質問で `{"facts": []}` が返り、NPC が「わかりません」になる。

原因：プロンプトが「職業・役割に関連する質問のみ生成可」と制約していたため、「住んでいる町」のような個人情報が対象外になっていた。

対策：
- 「NPC 自身に関する質問（名前・住居・出身・家族・日常など）は推測でも必ず生成」に拡張
- few-shot 例を「名前」「場所」「酒場の名前」「住んでいる町」の 4 種に拡充

### certainty が NPC 返答に反映されていなかった
`getNpcFacts()` が `"subject predicate object"` 文字列を返すだけで certainty 情報が欠落していた。

対策：
- Cypher クエリに `b.certainty AS certainty` を追加（`-[b:BELIEVES]->` エイリアス付与）
- certainty < 0.8 の場合に `(certainty:0.5)` を文字列に付与
- `generateNpcReply()` のプロンプトに「確信度が低い場合は曖昧な表現を使う」指示を追加

### Neo4j 構文エラー
`-[:BELIEVES]->` でエイリアスなしに `b.certainty` を参照していたためエラー。`-[b:BELIEVES]->` で修正。

---

## 4. 実装して良かったこと

### デバッグログ（`llm-debug.log`）
各フェーズ（REQUEST/RESPONSE）をファイルに追記する `logToFile()` を追加したことで、LLM が何を受け取り何を返したかが即座に確認できた。プロンプト改善のサイクルが大幅に短縮された。

### プレースホルダーフィルタの一元化
`PLACEHOLDER_PATTERN` を一箇所に定義し、入力（existingFacts）・出力（parseFacts）・NPC返答入力（generateNpcReply）の 3 箇所で同じパターンを使うことで、汚染ファクトが各ステージで確実に除去される構造にできた。

### 述語正規化マップ
`PREDICATE_MAP` により、モデルが返す非標準 predicate（`is_part_of` → `part_of` 等）を吸収できる構造にした。`json_schema` 制約と二重のガードになっている。

---

## 5. 今後やること（優先度付き）

| 優先度 | 内容 |
|---|---|
| 高 | **会話履歴の表示**（現状は直前の返答のみ、ゲームとして成立しない） |
| 高 | **複数NPC対応**（NPC選択 UI、現状は酒場の娘固定） |
| 高 | **グラフ初期データ（シード）の仕組み**：ゲーム開始時に世界設定をあらかじめ DB に登録し、LLM の hallucination に頼らない骨格を作る |
| 中 | **NPC 固有ペルソナ設定**（口調・知識範囲の個別定義） |
| 中 | **グラフ可視化**（知識グラフをビジュアルで確認） |
| 中 | **既存の汚染ファクト削除 UI または管理エンドポイント**（現状は手動で Neo4j を操作） |
| 低 | 認証・セッション管理 |
| 低 | デプロイ構成（Docker Compose 完全版） |

---

## 6. 設計上の学び

### 「LLM に全て任せる」と品質が不安定
ローカルモデルは指示への遵守度が低く、`objectName: "不明"` のような bad output が混入する。LLM の出力をそのままグラフに書くのではなく、**バリデーション・フィルタ・正規化を挟む防衛層**が必須。

### certainty は「知らない」と「推測」を分ける鍵
`{"facts": []}` を返すのは「全く関与しえない話題のみ」とし、NPC が知りうることは低 certainty でも生成する設計にすることで、会話の自然さが改善した。certainty 値を NPC 返答プロンプトに渡すことで「たしか〜」「わかりません」の使い分けが可能になった。

### プロンプトは few-shot 例が最も効く
ルールの文章だけでは LLM が意図通りに動かないことが多い。「あなたの住んでいる町は？ → `located_in` の例」のように具体的な入出力ペアを追加するたびに精度が上がった。
