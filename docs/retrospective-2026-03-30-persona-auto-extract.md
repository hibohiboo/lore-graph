# 振り返りレポート — lore-graph NPC返答からのペルソナ自動抽出

作成日: 2026-03-30

---

## 1. 概要

NPC の返答に含まれる一人称・語尾・口調などのペルソナ情報を自動的に抽出し、
Neo4j の Persona ノードに追記する機能を追加した。
あわせてフロントエンドの「新たに判明したこと」セクションを
Fact（事実）とペルソナ（性格・口調など）に分けて表示できるようにした。

---

## 2. 作ったもの

### 変更後の会話フロー（追加部分）

```
generateNpcReply → npcReply
  │
  ├─ extractFactsFromText(返答, 質問)        → replyFacts  → mergeFactsToGraph
  └─ extractPersonaHintsFromReply(NPC名, 返答, 既存ペルソナ)   ← 新規
       ↓ 新情報あれば
       upsertPersona({ ...既存 + dedup(新項目) })  → Neo4j更新
       ↓
       return { npcReply, newFacts, newPersonaHints }  ← レスポンスに追加
```

### 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `packages/schema/src/fact.ts` | `PersonaHintsSchema` / `PersonaHints` 型を追加 |
| `apps/backend/src/services/llm.ts` | `extractPersonaHintsFromReply` を追加。`PersonaHintsSchema` を `@repo/schema` から import |
| `apps/backend/src/routes/conversation.ts` | `extractPersonaHintsFromReply` + `upsertPersona` を呼び出し。レスポンスに `newPersonaHints` 追加 |
| `apps/game-client/src/hooks/useConversation.ts` | `newPersonaHints` state を追加。レスポンスから parse |
| `apps/game-client/src/components/ConversationPanel.tsx` | Fact / ペルソナの2セクション表示。カテゴリラベル付き |
| `apps/game-client/src/index.css` | `.discovery-tag--fact`（琥珀）/ `.discovery-tag--persona`（青）/ `.persona-hint-chip` 追加 |

### `extractPersonaHintsFromReply` のプロンプト設計

```
【手順】
1. 返答中の一人称（俺・僕・私・あたし・うち等）を探す
   → 登録済みなら追加しない
   → 未登録なら personalities に「一人称は「X」」を追加
2. 未登録の語尾・口調があれば personalities に追加
3. 職業・役割の新情報があれば roles に追加
4. 知識範囲の新情報があれば knowledgeScopes に追加

【重要ルール】
- 値には返答中の実際の言葉のみ使う（?や？などのプレースホルダー禁止）
- 確信がない場合は追加しない
- 登録済みと重複する場合は追加しない
```

### フロントエンド表示

```
▾ 新たに判明したこと (3件)

[Fact]    記録された事実
  酒場の娘 — is — リン  100%

[ペルソナ]  追加されたペルソナ
  性格・口調  一人称は「俺」
```

- `[Fact]` タグ: 琥珀色（既存の Fact テーマ）
- `[ペルソナ]` タグ: 青系（Fact と視覚的に区別）
- カテゴリ（性格・口調 / 職業・役割 / 知識範囲）を左側に表示

### 重複排除ロジック（バックエンド）

```typescript
const dedup = (existing: string[], additions: string[]) => {
  const set = new Set(existing);
  return [...existing, ...additions.filter((v) => !set.has(v))];
};
```

LLM 側でも登録済み情報をプロンプトに含めて除外しているが、
コード側でも Set による完全一致チェックを行いニ重追加を防ぐ。

---

## 3. 技術選定の判断

### `PersonaHintsSchema` を `@repo/schema` に置いた理由

フロントエンドが `newPersonaHints` をレスポンスから Zod parse するために
`PersonaHintsSchema` が必要。
バックエンド専用パッケージに定義すると frontend が import できないため、
中立パッケージ `@repo/schema` に置いた（`FactRecord`・`NpcPersona` と同じ方針）。

### `extractFactsFromText` と `extractPersonaHintsFromReply` を並列実行

```typescript
const [replyFacts, personaHints] = await Promise.all([
  extractFactsFromText(npcReply, playerMessage),
  extractPersonaHintsFromReply(npcName, npcReply, persona),
]);
```

2つの LLM 呼び出しは互いに独立しているため並列化。
会話1ターンあたりのレイテンシを削減。

### レスポンスに `newPersonaHints` を追加した理由

バックエンドで静かに保存するだけでなく、フロントエンドで「何が追加されたか」を
ユーザーが即座に確認できるようにするため。
PersonaPanel を開かなくても会話画面内で追記内容を把握できる。

---

## 4. 実装して良かったこと

### 「Fact と ペルソナを別タグで区別」する表示

琥珀（Fact）と青（ペルソナ）の2色でタグを分けることで、
「グラフDBに記録された情報」と「NPCキャラクターとして追加された情報」が
視覚的にすぐ区別できる。

### dedup をコード側にも持つ二重防御

LLM への「登録済みは追加しない」という指示に加え、
コード側の `Set` による重複排除も入れた。
LLM が稀に指示を無視した場合でも DB に重複が入らない。

---

## 5. 苦労したこと・課題

### 「?」が一人称として抽出される問題

最初のプロンプトでは「登録済みの場合は追加しない」例を示していなかった。
「私」が登録済みの状態で「私、リンだぜ。」という返答があると、
LLM は「一人称はあるが登録済みなので追加したくない → でも形式が必要 → `?` で埋める」
という混乱した挙動を示した。

→ **対策**:
1. 登録済みケースの抽出例（→ 空配列）を最初の例として明示
2. `「?」「？」「X」などのプレースホルダーは絶対に使わない` を重要ルールに追加
3. `確信が持てない場合は追加しない（誤情報より空のほうがよい）` を追加

→ **教訓**: 小規模モデル（qwen2.5:7b）への few-shot 例は
「すべきこと」だけでなく「すべきでないケース」も必ず例示する。
特に「登録済みで何もしない」ケースは暗黙的に伝えると誤動作する。

### `語尾であれ` のような幻覚

確信が持てない場合の扱いを定義していなかったため、LLM が造語を生成した。
`確信が持てない場合は追加しない` を明記して解消。

---

## 6. 今後やること（優先度付き）

| 優先度 | 内容 |
|---|---|
| 高 | **複数NPC対応**（NPC選択UI。現状は酒場の娘固定） |
| 中 | **`newFacts` の重複排除**（question由来とreply由来の同一factを1件に） |
| 中 | **グラフ可視化**（知識グラフをビジュアルで確認） |
| 低 | 会話履歴の Neo4j 永続化 |
| 低 | 認証・セッション管理 |
| 低 | デプロイ構成（Docker Compose 完全版） |

---

## 7. 設計上の学び（累積追加分）

### few-shot 例は「NGケース」も必ず示す

LLM へのプロンプトで「X はするな」と書いても、
実際に「すべきでない状況でどう返すか」の例がないと
モデルは迷って幻覚を起こす。
特に「登録済みなら空を返す」のような「何もしない」ケースは
明示的な例示が必須。

### プレースホルダー禁止は明文化する

`?`・`？`・`X` のようなプレースホルダーを LLM が出力するのを防ぐには、
「返答中に実際に存在する言葉のみ使う」と「プレースホルダー禁止」を
両方明記する必要がある。片方だけでは不十分。

### LLM への2つの独立した処理は `Promise.all` で並列化する

`extractFactsFromText` と `extractPersonaHintsFromReply` は互いに依存しない。
順番に呼ぶと2倍の待ち時間になるため、常に並列化を検討する。
