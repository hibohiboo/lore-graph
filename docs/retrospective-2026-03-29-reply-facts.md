# 振り返りレポート — lore-graph NPC返答からのFact抽出

作成日: 2026-03-29

---

## 1. 概要

NPC が返答で言及した情報（名物料理・人物情報など）がグラフDBに保存されていなかった問題を解決した。
会話フローに「NPC返答からのFact抽出」ステップを追加し、返答に含まれる新情報を自動的に永続化する。

---

## 2. 作ったもの

### 変更後の会話フロー

```
POST /api/conversation
  │
  ├─① generateFactsFromQuestion(質問)
  │     ↓ newFacts → mergeFactsToGraph
  │
  ├─② generateNpcReply(返答生成)
  │     ↓ npcReply
  │
  ├─③ extractFactsFromText(返答 + 質問) ← 追加
  │     ↓ replyFacts → mergeFactsToGraph
  │
  └─ return { npcReply, newFacts: [...newFacts, ...replyFacts] }
```

### 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `apps/backend/src/routes/conversation.ts` | `extractFactsFromText` 呼び出し追加。`replyFacts` を保存・レスポンスに含める |
| `apps/backend/src/services/llm.ts` | `extractFactsFromText` に `playerMessage?: string` 引数追加。質問文脈をプロンプトに組み込む |

### `extractFactsFromText` のプロンプト変更

**変更前（テキストのみ）:**
```
[user] 黒潮亭の名物は、こだわりの魚介料理と手作りのお酒だぜ。
```

**変更後（質問＋返答の文脈セット）:**
```
[user] プレイヤーの質問: この店の名物は？
       NPCの返答: 黒潮亭の名物は、こだわりの魚介料理と手作りのお酒だぜ。
```

質問の文脈があることで「こだわりの魚介料理」が「黒潮亭の名物」として正しく紐付けられる。

---

## 3. 技術選定の判断

### 既存の `extractFactsFromText` を再利用

`llm.ts` に既に `extractFactsFromText` が実装されていたが、会話フローで使われていなかった（dead codeに近い状態）。
新たな LLM 関数を作らず、引数を追加して転用した。

### `playerMessage` をオプショナル引数にした理由

`extractFactsFromText` は seed 登録など他の場所から呼ばれる可能性もある。
`playerMessage` を必須にすると既存の呼び出し箇所を全て変更する必要が生じるため、オプショナルにして後方互換を維持した。

### 返答からの Fact も `newFacts` に含めてレスポンスする

フロントエンドの「新たに判明したこと」表示は `newFacts` を使っている。
`replyFacts` も同じ配列にマージすることで、NPC返答由来の情報も UI に表示される。

### Neo4j の MERGE で重複排除

`generateFactsFromQuestion` と `extractFactsFromText` が同じ事実を生成することがある。
`mergeFactsToGraph` は `MERGE` を使うため、DB側で重複なく保存される。

---

## 4. 実装して良かったこと

### 「返答と質問をセットで渡す」設計

NPC 返答単体では曖昧な情報（「こだわりの魚介料理」だけでは何の情報か不明）も、
質問（「この店の名物は？」）と合わせることで `黒潮亭 is こだわりの魚介料理` として抽出できる。
文脈を渡す設計にしたことで抽出精度が上がる。

### 変更が最小限

`conversation.ts` に6行、`llm.ts` に3行の変更だけで機能追加できた。
既存のパイプライン（`mergeFactsToGraph`・`parseFacts`・`PLACEHOLDER_PATTERN` フィルタ）がそのまま再利用されている。

---

## 5. 苦労したこと・課題

### NPC が「推測・創作」した情報も保存される問題

NPC 返答はグラフDBに存在しない情報を LLM が補完・創作することがある。
「黒潮ビーフカレー」のように、プレイヤーが登録した事実にも世界設定にも存在しないものが返答に含まれ、
そのままグラフDBに書き込まれる。

→ **現状**: 許容している（ゲームとして「NPC が知っているとわかった情報」として成立する）
→ **課題**: 矛盾する情報が蓄積されると整合性が崩れる可能性がある

### `generateFactsFromQuestion` との重複抽出

同じ会話で `generateFactsFromQuestion`（質問から）と `extractFactsFromText`（返答から）が
同じ事実を生成することがある。DB は MERGE で保護されるが、フロントの `newFacts` 表示で
同じ内容が2件表示される可能性がある。

→ **対策**: 現時点では未対処。将来的には subject + predicate + object で重複排除する。

---

## 6. 今後やること（優先度付き）

| 優先度 | 内容 |
|---|---|
| 高 | **会話履歴の表示**（現状は直前の返答のみ。ゲームとして成立しない） |
| 高 | **複数NPC対応**（NPC選択 UI と複数 NPC のペルソナ管理） |
| 中 | **newFacts の重複排除**（question由来とreply由来の同一factを1件に） |
| 中 | **グラフ可視化**（知識グラフをビジュアルで確認） |
| 低 | 認証・セッション管理 |
| 低 | デプロイ構成（Docker Compose 完全版） |

---

## 7. 設計上の学び（累積追加分）

### LLM への入力は「文脈セット」で渡す

単体のテキストより、質問と返答をペアで渡すほうが事実の主語・目的語が正確に抽出される。
「何について答えているか」という文脈が、抽出品質を左右する。

### 実装済み関数が使われていないことへの注意

`extractFactsFromText` は以前から存在していたが会話フローで使われていなかった。
dead code に近い状態のまま放置されていた。
定期的に「実装済みだが未使用の関数」を棚卸しする習慣が必要。
