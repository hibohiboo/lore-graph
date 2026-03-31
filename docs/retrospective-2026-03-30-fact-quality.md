# 振り返りレポート — lore-graph Fact 品質改善・ゴミ返答対策

作成日: 2026-03-30

---

## 1. 概要

Neo4j に蓄積される Fact のノイズ（代名詞 subject・指示語 subject）を削減し、
LLM の非日本語ゴミ返答を検出・リトライする防衛機構を追加した。
あわせてプロンプトに渡す fact の件数を質問関連度でフィルタリングし、
小モデルへの入力トークンを削減した。

---

## 2. 作ったもの

### 変更一覧

| ファイル | 変更内容 |
|---|---|
| `apps/backend/src/services/llm.ts` | `isGarbageReply` / `PRONOUN_SUBJECTS` / `filterRelevantFacts` 追加、各プロンプト改善、3回リトライ |
| `apps/backend/src/routes/conversation.ts` | ゴミ返答時 500 + 日本語エラーメッセージ |
| `apps/game-client/src/hooks/useConversation.ts` | `!res.ok` 時にレスポンスボディの `error` フィールドを読んで表示 |

### ① ゴミ返答検出・リトライ（`isGarbageReply` + ループ）

```typescript
const isGarbageReply = (text: string): boolean =>
  /<\|/.test(text) ||          // <|channel|> 等のモデルトークン
  /^\s*\{/.test(text) ||       // JSON 返答
  !/[\u3040-\u30FF\u4E00-\u9FAF]/.test(text); // 日本語文字が一切ない

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {   // MAX_RETRIES = 3
  const reply = ...;
  if (!isGarbageReply(reply)) return reply;
  logToFile(`generateNpcReply - GARBAGE (attempt ${attempt}/3)`, reply);
}
return '';  // 全試行失敗
```

3回全て失敗した場合は `''` を返し、`conversation.ts` で 500 + 日本語エラーを返す。
フロントエンドは `res.json().error` を読んで「NPC の返答に失敗しました。もう一度試してください。」と表示。

### ② 代名詞 subject の除去（二層防衛）

**プロンプト側**（`generateFactsFromQuestion`）:
```
subjectNameには代名詞・汎称を使わない。「私」「俺」「僕」「あたし」「うち」
「あなた」「君」「NPC」は絶対に禁止。
```

**コード側**（`parseFacts`）:
```typescript
const PRONOUN_SUBJECTS = new Set(['私', '俺', '僕', 'あたし', 'うち', 'あなた', '君', 'NPC']);
if (PRONOUN_SUBJECTS.has(f.subjectName)) return [];  // DB に入れない
```

LLM がプロンプトの指示を無視した場合も `PRONOUN_SUBJECTS` フィルターで除去。

### ③ 指示語 subject の除去（`extractFactsFromText` プロンプト）

「この町 is 港町」のような指示語 subject が DB に入るのを防ぐ:

```
subjectNameのルール：
- 必ず固有名詞を使う
- 「この町」「この酒場」「ここ」などの指示語は subjectName に使わない
- テキスト中に固有名詞が見つからない場合はその事実を抽出しない
例）「この町は港町だぜ」（固有名詞なし）→ {"facts":[]}
```

あわせて `generateNpcReply` に「固有名詞を使う」指示を追加し、
NPC が「この町」ではなく「リューン」と発話するよう誘導。

期待するパターン:
```
リン located_in リューン  (certainty:1.0)
リューン is 港町          (certainty:1.0)
```

### ④ 関連 Fact フィルタリング（`filterRelevantFacts`）

```typescript
const filterRelevantFacts = (facts, playerMessage, npcName) => {
  if (facts.length <= MAX_FACTS_IN_PROMPT) return facts;  // MAX=15
  const keywords = playerMessage で 2文字以上のトークンを抽出;
  const scored = facts.map(fact => ({
    fact,
    score: (fact.startsWith(npcName) ? 10 : 0)   // NPC 自身の fact は優先
         + keywords.filter(k => fact.includes(k)).length
  }));
  return scored.sort(...).slice(0, MAX_FACTS_IN_PROMPT);
};
```

`generateNpcReply` と `generateFactsFromQuestion` の両方で適用。
「この町はどんな町？」→ 店長・人間関係系の fact が落ち、場所・施設系が優先される。

### ⑤ 推測表現の Fact 抽出（`extractFactsFromText` プロンプト）

以前は「んじゃないかな」「みたい」の返答から fact が抽出されなかった。
certainty 基準の明示と例示を追加:

```
- 「んじゃないかな」「みたい」「たしか〜」などの推測: certainty 0.5〜0.6
- 「らしい」「と聞いた」などの伝聞: certainty 0.4〜0.5
推測・伝聞は {"facts":[]} にせず低めの certainty で必ず抽出
例）「サバやタチウオがよく獲れるんじゃないかな」
  → {"facts":[{"subjectName":"近海","predicate":"related_to","objectName":"サバ・タチウオ","certainty":0.6}]}
```

---

## 3. 技術選定の判断

### ゴミ返答を「リトライ」で解決した理由

小モデル（qwen2.5:7b）の `<|channel|>` トークン漏洩は確率的に発生する。
エラーを返してユーザーに再送を強いると UX が悪い。
LLM 呼び出しはべき等なので、バックエンドで最大3回リトライするのが自然。
3回で解消しない場合は LLM 側の問題と判断してエラーを返す。

### `filterRelevantFacts` をコードで実装した理由（LLM フィルタリングを使わない）

「関連 fact の選択」を別の LLM 呼び出しで行う方法もあるが:
- 1ターンで2回の LLM 呼び出しになりレイテンシが倍増する
- qwen2.5:7b 程度のモデルで fact の意味的関連度を判定させると精度が低い

キーワードマッチング + NPC 自身 fact 優先のシンプルな実装で
「店長情報が町質問時に入らない」という実用的な目的は達成できる。

### エラーメッセージを JSON ボディで返した理由

HTTP ステータスだけだとフロントエンドは `"500 Internal Server Error"` しか表示できない。
`{ error: "日本語メッセージ" }` を JSON で返すことで、
フロントエンドはユーザーに意味のあるメッセージを表示できる。

---

## 4. 実装して良かったこと

### 二層の代名詞フィルター

LLM プロンプトだけでは小モデルが指示を無視することがある。
コード側の `PRONOUN_SUBJECTS` set によるフィルターを加えることで、
「プロンプトが守られなかった場合でも DB が汚れない」保証が得られた。

### `filterRelevantFacts` の NPC 自身 fact 優先スコア

`fact.startsWith(npcName)` に +10 のボーナスを与えることで、
「NPC 自身の名前・場所・役割」は質問内容に関わらず常にプロンプトに含まれる。
これにより「誰と話しているか」のコンテキストが失われない。

---

## 5. 苦労したこと・課題

### `<|channel|>` ゴミ返答が `extractFactsFromText` で幻覚 fact を生成した

ゴミ返答（`<|channel|>commentary...`）がそのまま `extractFactsFromText` に渡ると、
LLM が無関係な fact（`銀嶺亭 is 酒場`）を幻覚で出力した。
ゴミ返答の検出・早期リターンと、`!npcReply` チェックによる抽出スキップで解消。

→ **教訓**: LLM の出力は必ず検証してから後段に渡す。
特に別の LLM 呼び出しへの入力として使う場合は「無入力よりゴミ入力のほうが危険」。

### 「この町」が subjectName になる問題

小モデルは「固有名詞を使え」という指示があっても、
good example がないと指示語をそのまま subjectName に使いがち。
「この町は港町だぜ → {"facts":[]}」の NGケース例示で解消した。

→ **教訓**: 前回と同じパターン。NGケースの例示は必須。
今回は「固有名詞なし → 空配列」という「何もしない」ケースの例示が効いた。

### `filterRelevantFacts` は facts ≤ 15 件のとき無効

現在 facts が 25 件前後あるのでフィルタが動いているが、
少ない場合（新規NPC等）はフィルタなしで全件渡す。
将来 facts が増えた場合のしきい値調整が必要になる可能性がある。

---

## 6. 今後やること（優先度付き）

| 優先度 | 内容 |
|---|---|
| 高 | **NPC 切り替え時の会話リセット**（`key={currentNpc}` で再マウント） |
| 高 | **2人目の NPC 追加**・複数 NPC 選択動作確認 |
| 高 | **既存ノイズ fact の Neo4j クリーンアップ**（`私 is リン`・`君 is リン` 等） |
| 中 | **`newFacts` の重複排除**（question由来とreply由来の同一 fact を1件に） |
| 中 | **グラフ可視化**（知識グラフをビジュアルで確認） |
| 中 | `filterRelevantFacts` のしきい値調整（facts 件数増加に備えて常時フィルタに変更） |
| 低 | 会話履歴の Neo4j 永続化 |
| 低 | 認証・セッション管理 |
| 低 | デプロイ構成（Docker Compose 完全版） |

---

## 7. 設計上の学び（累積追加分）

### LLM の出力は後段 LLM に渡す前に必ず検証する

LLM-A の出力を LLM-B の入力に使うパイプラインでは、
LLM-A がゴミを返した場合に LLM-B が幻覚で補完してしまう。
検証ゲート（`isGarbageReply` 等）をパイプラインの境界に置くこと。

### プロンプトの「NGケース」+ コードフィルターの二重防衛

小モデルへの指示は「するな」だけでは守られないことがある。
1. プロンプトに「このケースは空配列を返す」という具体的 NGケース例を示す
2. コード側でも同じ条件をフィルタとして実装する

どちらか一方が欠けると DB 汚染が起きる。両方あれば確実。

### キーワードマッチングは「NPC 自身の情報を常に保護する」設計にする

関連 fact フィルタリングを実装するとき、
質問と無関係な NPC 自身の fact（名前・場所）まで落ちてしまうと
NPC が「自分が誰か」を忘れた返答をする。
NPC 名 prefix の fact には固定ボーナスを与えて常に保護する。
