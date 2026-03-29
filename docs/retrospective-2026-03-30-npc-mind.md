# 振り返りレポート — lore-graph packages/npc-mind + 複数NPC対応基盤

作成日: 2026-03-30

---

## 1. 概要

静的な NPC 定義を管理する `packages/npc-mind` パッケージを新規作成し、
NPC 固有の役割・性格・知識範囲をコードベースで一元管理できるようにした。
あわせて `GET /api/npcs` エンドポイントと NPC 選択 UI を追加し、
複数 NPC 対応の基盤を整えた。

---

## 2. 作ったもの

### 変更後のアーキテクチャ（追加部分）

```
packages/npc-mind
  └── NPC_REGISTRY (静的定義)
        ├── NpcDefinition { name, role, personality, knowledgeScope }
        ├── getNpcDefinition(name): NpcDefinition | undefined
        └── listNpcNames(): string[]

apps/backend
  ├── routes/npcs.ts      GET /api/npcs → { npcs: string[] }
  └── services/llm.ts
        ├── generateNpcReply(..., npcDef?)          ← NpcDefinition を受け取るように更新
        └── generateFactsFromQuestion(..., npcDef?) ← NpcDefinition を受け取るように更新

apps/game-client
  ├── hooks/useNpcList.ts  ← GET /api/npcs を fetch する hook
  └── App.tsx              ← NPC 選択 <select>（npcs.length > 1 のときのみ表示）
```

### モノレポ / パッケージ構成

| パッケージ | 役割 |
|---|---|
| `packages/schema` | Zod スキーマ・共有型（NpcPersona, ExtractedFact, PersonaHints など） |
| `packages/graph-db` | Neo4j アクセス層（getNpcFacts, getPersona, upsertPersona など） |
| `packages/npc-mind` | 静的 NPC 定義レジストリ（NpcDefinition, NPC_REGISTRY） |
| `packages/eslint-config` | ESLint 共通設定 |
| `packages/typescript-config` | tsconfig ベース設定 |
| `apps/backend` | Hono API サーバー |
| `apps/game-client` | React フロントエンド |

### 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `packages/npc-mind/src/persona.ts` | `NpcDefinition` 型・`NPC_REGISTRY`・`getNpcDefinition`・`listNpcNames` を追加 |
| `packages/npc-mind/src/index.ts` | `NpcDefinition`・`getNpcDefinition`・`listNpcNames` を export |
| `apps/backend/package.json` | `"@repo/npc-mind": "*"` を dependencies に追加 |
| `apps/backend/src/services/llm.ts` | `generateNpcReply` / `generateFactsFromQuestion` に `npcDef?: NpcDefinition` 引数を追加 |
| `apps/backend/src/routes/conversation.ts` | `getNpcDefinition` を呼び出して LLM 関数に渡す |
| `apps/backend/src/routes/npcs.ts` | 新規: `GET /api/npcs` |
| `apps/backend/src/index.ts` | `/api/npcs` ルートをマウント |
| `apps/game-client/src/hooks/useNpcList.ts` | 新規: NPC 一覧取得 hook |
| `apps/game-client/src/App.tsx` | NPC 選択 UI + `selectedNpc` state |
| `apps/game-client/src/index.css` | `.npc-selector` スタイル追加 |

### `NpcDefinition` vs `NpcPersona` の使い分け

| 型 | 所在 | 内容 | 更新タイミング |
|---|---|---|---|
| `NpcDefinition` | `@repo/npc-mind` | 静的定義（string 単体）| コード変更時のみ |
| `NpcPersona` | `@repo/schema` / Neo4j | 自動抽出された配列 | 会話のたびに更新 |

`NpcDefinition` は人間が書いた詳細な説明文（「明るく親しみやすい。常連客には砕けた口調、初対面には丁寧語。」）。
`NpcPersona` は LLM が NPC 返答から自動抽出した断片（`["一人称は「俺」"]` など）。

### LLM プロンプトへの組み込み方

**generateNpcReply:**
```
あなたは「${npcName}」というNPCです。
職業・役割: ${npcDef.role}           ← 静的定義（NpcDefinition）
性格・口調: ${npcDef.personality}
知識範囲: ${npcDef.knowledgeScope}
追加された口調: ${persona.personalities} ← 自動抽出（NpcPersona）
次の情報を知っています：...
```

**generateFactsFromQuestion:**
```
NPC「name」の職業・役割: ${npcDef.role}
NPC「name」の知識範囲: ${npcDef.knowledgeScope}
追加された知識範囲: ${persona.knowledgeScopes}
職業・役割に関連する質問には必ず事実を生成してください。
```

ペルソナ未登録時の汎用フォールバック文（「例えば酒場の娘なら〜」）は
`npcDef` がある場合は使われず、具体的な定義で置き換わる。

### NPC 選択 UI

- `useNpcList` hook が `GET /api/npcs` を fetch し `npcs: string[]` を返す
- `npcs.length > 1` のときのみ `<select>` を表示（現在 NPC が1人なら表示されない）
- `selectedNpc` が未選択の場合は `npcs[0]` を使用（初期値の暗黙的な決定）

---

## 3. 技術選定の判断

### 静的定義を `@repo/npc-mind` に分離した理由

バックエンドの `llm.ts` に NPC 定義を直書きすると、
NPC を追加するたびにサービス層を直接変更することになる。
`npc-mind` に分離することで：
1. NPC 定義の追加が `NPC_REGISTRY` の1エントリ追加で完結
2. バックエンド・フロントエンドのどちらからも参照できる中立パッケージとして機能
3. 将来 Neo4j や外部ファイルへの移行もこのパッケージ境界内で完結

### `NpcDefinition` に string フィールドを使った理由

`NpcPersona`（配列）は自動抽出の断片を積み上げるための型。
`NpcDefinition` は人間が書いた完全な説明文が1つあれば十分なため、
配列でなく単一 string で定義した。
LLM へは「文章として自然に読める一文」として渡すほうが
プロンプト効率が良い。

### NPC 選択 UI を `npcs.length > 1` 条件付きにした理由

現時点で NPC は1人のため、常に表示すると画面ノイズになる。
NPC を追加したタイミングで自動的に表示される設計にすることで、
将来の拡張に対して UI 側のコード変更が不要になる。

---

## 4. 実装して良かったこと

### 静的定義と動的ペルソナの二層構造

`NpcDefinition`（コード管理・文章）と `NpcPersona`（DB・配列）を分けたことで、
- LLM プロンプトに豊富な初期情報を渡せる（品質向上）
- 自動抽出されたペルソナは「追加情報」として重複なく積み上がる
- 両層が独立しているためどちらかを変更しても他方に影響しない

### NPC 一覧 API を薄い実装にできた

`createNpcsRoute` は `listNpcNames()` を呼ぶだけで5行。
DB アクセスなし・外部依存なし・テスト不要。
NPC レジストリがコードにある限りこの薄さを保てる。

### `sonarjs/jsx-no-leaked-render` への対応パターンの定着

`!npcsLoading && npcs.length > 1 && <JSX>` は lint エラー。
`Boolean(...)` も通らない（ルールが `boolean &&` 構文自体を禁止しているため）。
`条件 ? <JSX> : null` のパターンで対応することが確定した。

---

## 5. 苦労したこと・課題

### `sonarjs/jsx-no-leaked-render` — Boolean() も通らなかった

最初に `&& (...)` → `Boolean(...) && (...)` と修正したが、
どちらもエラー。最終的に `? (...) : null` が必要と判明した。

→ **教訓**: このルールは「`&&` 演算子を JSX のガードに使う構文全体」を禁止している。
`Boolean()` でラップしても演算子の構文は変わらないため解消しない。
JSX の条件付きレンダリングは常に三項演算子（`? ... : null`）を使うこと。

### `NPC_REGISTRY` はコード管理のため、NPC 追加に deploy が必要

現在の設計では NPC を追加するには `npc-mind/src/persona.ts` を変更してデプロイが必要。
動的に NPC を追加したい場合（ゲームマスターが UI から登録するなど）は
Neo4j に NPC 定義を保存するレイヤーへの移行が必要になる。

### NPC 選択後に会話がリセットされない

`selectedNpc` を変更しても `useConversation` の `history` state は
`ConversationPanel` の key が変わらない限りリセットされない。
現在は NPC が1人なので問題ないが、複数 NPC を本格稼働させるには
`<ConversationPanel key={currentNpc} npcName={currentNpc} />` のような
key による再マウントが必要。

---

## 6. 今後やること（優先度付き）

| 優先度 | 内容 |
|---|---|
| 高 | **NPC 切り替え時の会話リセット**（`key={currentNpc}` で再マウント） |
| 高 | **NPC を追加して複数 NPC 選択を実際に動作確認** |
| 中 | **`newFacts` の重複排除**（question由来とreply由来の同一factを1件に） |
| 中 | **グラフ可視化**（知識グラフをビジュアルで確認） |
| 低 | NPC 定義の Neo4j 移行（UI からの動的登録が必要になった場合） |
| 低 | 会話履歴の Neo4j 永続化 |
| 低 | 認証・セッション管理 |
| 低 | デプロイ構成（Docker Compose 完全版） |

---

## 7. 設計上の学び（累積追加分）

### JSX の条件付きレンダリングは常に三項演算子

`sonarjs/jsx-no-leaked-render` ルールにより、
`boolean && <JSX>` は `Boolean() &&` でも通らない。
`条件 ? <JSX> : null` の形式を統一して使うこと。

### 静的設定とランタイムデータは型から分離する

「コードで管理する設定」（NpcDefinition）と「DBで管理するデータ」（NpcPersona）は
フィールド構造が違っていてよい。
目的に合った型を別々に定義して、LLM プロンプト生成時に結合するパターンは
可読性・保守性ともに優れている。
