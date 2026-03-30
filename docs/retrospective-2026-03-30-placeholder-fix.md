# 振り返りレポート — lore-graph プレースホルダー Fact 根絶・造語生成

作成日: 2026-03-30

---

## 1. 概要

`generateFactsFromQuestion` が `[町名]`・`[名前]` のような括弧付きプレースホルダーを
fact の objectName として出力し続けていた根本原因（プロンプトの例示自体がプレースホルダーだった）を特定・修正した。
あわせて NPC が住む町名など未定義の固有名詞を造語させる仕組みを導入し、
「住んでいる町の名前は？」に「わかりません」と返答される問題を解消した。

---

## 2. 作ったもの

### 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `apps/backend/src/services/llm.ts` | `PLACEHOLDER_PATTERN` 拡張→ `hasPlaceholder` 関数化・`generateFactsFromQuestion` 例示を実名に変更・造語ルール追加 |

### ① `[...]` プレースホルダーの検出

**変更前:**
```typescript
const PLACEHOLDER_PATTERN = /不明|unknown|？|\?|未定|なし|none/i;
```

**変更後:**
```typescript
const PLACEHOLDER_WORD_PATTERN = /不明|unknown|未定|なし|none/i;
const hasPlaceholder = (s: string): boolean =>
  PLACEHOLDER_WORD_PATTERN.test(s) || s.includes('?') || s.includes('？') || s.includes('[');
```

- 正規表現から `\?`・`\[[^\]]+\]` を外し、`includes` チェックに分離
- `sonarjs/slow-regex`（ReDoS 脆弱性警告）を回避
- `[名物料理]`・`[若い女性]` など既存 DB の括弧付き fact もプロンプトから除外される

### ② `generateFactsFromQuestion` の例示を実名に変更

**変更前（モデルがそのまま真似してプレースホルダーを出力していた）:**
```
例）プレイヤー「あなたの名前は？」→ objectName:"[名前]"
例）プレイヤー「ここはどこ？」→ objectName:"[場所名]"
例）プレイヤー「あなたの住んでいる町は？」→ objectName:"[町名]"
```

**変更後（造語した具体名を例示）:**
```
例）プレイヤー「あなたの名前は？」→ objectName:"リン"
例）プレイヤー「ここはどこ？」→ objectName:"黒潮亭"
例）プレイヤー「あなたの住んでいる町は？」→
  [{"subjectName":"酒場の娘","predicate":"located_in","objectName":"リューン","certainty":0.9},
   {"subjectName":"リューン","predicate":"is","objectName":"港町","certainty":0.8}]
```

### ③ 造語ルールの追加

```
- objectNameに「不明」「？」「未定」「[名前]」「[町名]」のようなプレースホルダーは絶対に使わない
- NPC自身に関する未知の情報（住んでいる町・出身地・家族の名前など）は
  ファンタジー世界に合う固有名詞を造語して使う
```

### 期待する動作フロー

```
プレイヤー「住んでいる町の名前は？」
  ↓
generateFactsFromQuestion
  → {"subjectName":"リン","predicate":"located_in","objectName":"リューン","certainty":0.9}
  → {"subjectName":"リューン","predicate":"is","objectName":"港町","certainty":0.8}
  ↓ Neo4j に保存
generateNpcReply（facts に "リン located_in リューン" を含む）
  → 「リューンに住んでいるよ。賑やかな港町だぜ。」
```

---

## 3. 技術選定の判断

### プレースホルダー検出を `includes` に分けた理由

`/不明|unknown|未定|なし|none|\[[^\]]+\]/i` は sonarjs が ReDoS の可能性があるとして
`sonarjs/slow-regex` エラーを出した。
代替として `Boolean()` ラップや possessive quantifier を検討したが
JavaScript は possessive quantifier を持たない。
最も単純な解決策は正規表現から `[...]` チェックを外し
`s.includes('[')` の文字列操作に置き換えること。
事実の文字列に `[` が来るのはプレースホルダーのケースのみなので誤検知なし。

### プロンプトの例示を動的な実名にした理由

small model（qwen2.5:7b）はプロンプトの例を強く模倣する（few-shot learning）。
`"objectName":"[名前]"` という例があれば、モデルは名前が不明なときに
`"objectName":"[リンの名前]"` を出力しようとする。
例示を `"objectName":"リン"` に変えることで
「具体的な固有名詞で答える」パターンを学習させる。

### 造語生成を `generateFactsFromQuestion` で行う理由（`generateNpcReply` ではない）

`generateNpcReply` に「まだ出ていない名前は明かすこと」と指示しても、
返答テキストから造語名が `extractFactsFromText` で正確に抽出されるとは限らない。
`generateFactsFromQuestion` で事前に造語 fact を Neo4j に保存することで：
1. 造語した名前が確実に DB に保存される
2. 次のターンでも同じ名前が fact として参照される（一貫性）
3. `generateNpcReply` は DB の fact をそのまま使えばよい

---

## 4. 実装して良かったこと

### プレースホルダーの根本原因を例示から特定できた

`[町名]` が DB に入り続ける理由として：
- LLM が指示を無視した
- PLACEHOLDER_PATTERN が `[...]` を検出できていなかった

の両方が原因だったが、**そもそもプロンプトの例示自体が `[町名]` を使っていた**という
根本原因に気づけたことが最も重要だった。
few-shot 例は LLM の出力形式を直接決定する。

### 住む町の two-fact パターン（`located_in` + `is`）

「住んでいる町は？」に対して：
- `リン located_in リューン`（NPC と町の関係）
- `リューン is 港町`（町の性質）

の2件を同時に生成させる例示が的確。
これにより後の「この町はどんな町？」への回答にも `リューン is 港町` が使える。

---

## 5. 苦労したこと・課題

### `sonarjs/slow-regex` — `\[[^\]]+\]` も警告対象

`\[.+?\]`（lazy）に加えて `\[[^\]]+\]`（文字クラス）も slow-regex として扱われた。
正規表現エンジンの実装によっては文字クラスでも計算量が問題になりうるとの判断らしい。
最終的に `includes('[')` という文字列操作で解決した。

→ **教訓**: ESLint の sonarjs/slow-regex は「潜在的に危険な正規表現全般」に広く反応する。
否定文字クラス `[^\]]+` でも通らないケースがある。
シンプルな文字列操作（`includes`・`startsWith` 等）で代替できるなら正規表現を使わない。

### 造語の一貫性はセッション間で保証されない

`generateFactsFromQuestion` が造語した「リューン」は Neo4j に保存されるが、
初回の会話で町名を聞かれなければ生成されない。
別のセッションで「この町の名前は？」と聞かれると「コガネ港」など別の名前が造語される可能性がある。
→ 対策: 世界設定の seed データとして予め主要な固有名詞（町名・地名）を登録しておくべき。

### 例示の固有名詞（リューン）が酒場の娘と無関係な設定になるリスク

例示の `"objectName":"リューン"` は実際のゲーム世界の設定と一致していない可能性がある。
モデルはこの例を直接使うわけではなく、あくまで「具体名を使うパターン」を学習するので問題ないが、
設定が固まったら seed データで上書きするのが望ましい。

---

## 6. 今後やること（優先度付き）

| 優先度 | 内容 |
|---|---|
| 高 | **世界設定 seed データに主要固有名詞（町名・地名）を追加**（造語の一貫性確保） |
| 高 | **NPC 切り替え時の会話リセット**（`key={currentNpc}` で再マウント） |
| 高 | **2人目の NPC 追加**・複数 NPC 選択の動作確認 |
| 高 | **既存ノイズ fact の Neo4j クリーンアップ**（`私 is リン`・`[名物料理]` 等） |
| 中 | **`newFacts` の重複排除**（question由来とreply由来の同一 fact を1件に） |
| 中 | **グラフ可視化**（知識グラフをビジュアルで確認） |
| 低 | 会話履歴の Neo4j 永続化 |
| 低 | 認証・セッション管理 |
| 低 | デプロイ構成（Docker Compose 完全版） |

---

## 7. 設計上の学び（累積追加分）

### few-shot 例の objectName は実際の固有名詞で書く

`"objectName":"[名前]"` のような例示は「プレースホルダーを使ってよい」という学習になる。
`"objectName":"リン"` のように実際の名前を使うことで
「具体的な固有名詞で埋める」というパターンを教える。
これは few-shot の最も基本的な原則だが、「テンプレート感覚」で書くと見落としやすい。

### 造語を「事前生成」ステップに任せ「返答生成」ステップに任せない

NPC が返答の中で初めて固有名詞を使うよりも、
`generateFactsFromQuestion` で事前に造語 fact を作り Neo4j に保存してから
`generateNpcReply` に参照させる設計のほうが一貫性が高い。
「何を答えるか」と「どう答えるか」を分離することで、
答えの内容が次の会話でも再利用できる。

### 正規表現の alternation は文字列操作に置き換えられないか常に検討する

`/a|b|c|\[[^\]]+\]/` のような複合パターンは sonarjs/slow-regex に引っかかりやすい。
`includes`・`startsWith`・`split` で代替できる部分は素直に文字列操作にする。
正規表現は「文字クラスの組み合わせ」が必要な場合（メールアドレス検証等）に限定する。
