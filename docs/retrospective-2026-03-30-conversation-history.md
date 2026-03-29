# 振り返りレポート — lore-graph 会話履歴機能

作成日: 2026-03-30

---

## 1. 概要

直前の1返答しか表示されなかった会話画面を、全ターンの履歴を積み上げて表示する形に刷新した。
あわせて LLM に会話履歴を渡すことで、文脈を踏まえた返答を生成できるようになった。

---

## 2. 作ったもの

### 変更後の会話フロー

```
[フロントエンド]
  history state (useState)
  ↓ 送信時: { npcName, playerMessage, history: 直前スナップショット }

[バックエンド POST /api/conversation]
  generateNpcReply(npcName, facts, playerMessage, persona, history)
  ↓ history を system直後に [user/assistant] として展開（最大5往復）

[LLM]
  system: キャラクター設定
  user:   過去プレイヤー発言 × n
  assistant: 過去NPC返答   × n
  user:   今回の発言
  → 文脈を踏まえた返答を生成

[フロントエンド]
  成功後: history に { role:'player', content } + { role:'npc', content } を追記
  → 全ターンを .chat-history にレンダリング
  → 最新メッセージへ自動スクロール
```

### 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `packages/schema/src/fact.ts` | `ConversationMessageSchema` / `ConversationMessage` 型を追加 |
| `apps/backend/src/services/llm.ts` | `generateNpcReply` に `history?: ConversationMessage[]` 引数追加。`HISTORY_LIMIT = 5` で切り詰め |
| `apps/backend/src/routes/conversation.ts` | リクエストスキーマに `history?: ConversationMessage[]` 追加 |
| `apps/game-client/src/hooks/useConversation.ts` | `history` state 追加。送信時にスナップショットをfetch bodyへ、成功後に追記 |
| `apps/game-client/src/components/ConversationPanel.tsx` | 全ターン履歴表示・ローディングバブル・`useEffect` 自動スクロール |
| `apps/game-client/src/index.css` | `.chat-history`・`.chat-bubble--player`・`.chat-bubble--npc` 追加 |

### UIコンポーネント構造

```
<section>
  <h2>酒場の娘 と話す</h2>

  <div.chat-history role="log" aria-live="polite">
    <div.chat-bubble--player>      ← 右寄せバブル（プレイヤー）
      <span.speaker-label>あなた：</span>
      <p>メッセージ</p>
    </div>
    <div.chat-bubble--npc>         ← 既存 blockquote（NPC）
      <p.npc-name-badge>酒場の娘</p>
      <blockquote>返答</blockquote>
    </div>
    ...（全ターン繰り返し）
    <div.chat-bubble--npc>         ← loading 中のみ表示
      <blockquote><LoadingDots /></blockquote>
    </div>
    <div ref={scrollRef} />        ← 自動スクロール目標
  </div>

  <label>あなた：</label>
  <textarea />
  <button.btn-send>送信</button>
</section>
```

---

## 3. 技術選定の判断

### 履歴保存を `useState` にした理由

Neo4j への永続化案もあったが、以下の理由で却下:
- `Message` ノード + セッション管理が必要でスコープが大幅拡大する
- ページリロードで履歴が消えることはゲームとして自然（酒場を退出・再訪）
- `useState` で要件を十分満たせる

### `HISTORY_LIMIT = 5`（往復5回 = 最大10メッセージ）

Ollama のローカル LLM（qwen2.5:7b）は context length が限られている。
全履歴を渡すと古いターンが増えるにつれトークンを圧迫し、返答品質が下がる。
5往復は「最近の文脈を維持しつつトークンを節約する」バランスとして設定。

### 送信前スナップショットを fetch body に渡す

`history` 更新は非同期のため、`sendMessage` 呼び出し時点の `history` state を
変数 `historySnapshot` にコピーしてから fetch body に渡す。
これにより「直前の返答が来る前に2回送信した」場合も、最後に送った時点の履歴が正しく送られる。

### ローディング中にNPCバブルを先出しする

`loading` が `true` の間、履歴の末尾に `LoadingDots` 入りのNPCバブルを表示する。
返答が来たら `loading` が `false` になりバブルが消え、`history` に実際の返答が追加される。
「考えているNPC」を視覚的に示す自然なUX。

### `role="log"` + `aria-live="polite"` の組み合わせ

会話ログ領域に `role="log"` を付けると `aria-live="polite"` が暗黙的に適用されるが、
明示的に `aria-live="polite"` も指定することでスクリーンリーダー対応を確実にした。

---

## 4. 実装して良かったこと

### `history` をスナップショットで渡す設計

React の state 更新は非同期なので、fetch body に `history` を直接渡すと
「更新後の history」が誤って送られるリスクがある。
`const historySnapshot = history;` でスナップショットを取ってから渡す方式は
並行送信の問題を防ぐ。

### `ConversationMessage` 型を `@repo/schema` に置いた

フロントエンド・バックエンド両方で使う型を `@repo/schema` に置く原則を守った。
バックエンドの Zod バリデーションとフロントエンドの型定義が一致するため型安全。

### 既存の `.npc-reply` / `blockquote` スタイルを `.chat-bubble--npc` として流用

CSS の再設計なしに、既存の `blockquote` / `.npc-name-badge` スタイルをそのまま使えた。
プレイヤーバブル（`.chat-bubble--player`）のみ新規スタイルを追加した。

---

## 5. 苦労したこと・課題

### `scrollbar-width` / `scrollbar-color` の `css/use-baseline` エラー

`.chat-history` のスクロールバースタイルに `scrollbar-width: thin` と `scrollbar-color` を書いたところ、
ESLint の `css/use-baseline` ルールで「Widely available ではない」として検出された。

→ 該当プロパティを削除してコメントに置き換えて解決。
  スクロールバーはデフォルトのブラウザスタイルになる。

→ **教訓**: CSS スクロールバースタイリングはベンダー依存が強く、このプロジェクトの Lint では使えない。
  `-webkit-scrollbar` 系も同様に引っかかる可能性が高い。

### 今後の課題: 履歴が長くなった場合のUI

`max-height: 420px` で `.chat-history` を切り詰めているが、
会話が長くなると古いメッセージへのスクロールが不便になる可能性がある。
現時点では許容している。

---

## 6. 今後やること（優先度付き）

| 優先度 | 内容 |
|---|---|
| 高 | **複数NPC対応**（NPC選択UI。現状は酒場の娘固定） |
| 中 | **`newFacts` の重複排除**（question由来とreply由来の同一factを1件に） |
| 中 | **グラフ可視化**（知識グラフをビジュアルで確認） |
| 低 | 会話履歴の Neo4j 永続化（ページリロードをまたいだ継続） |
| 低 | `HISTORY_LIMIT` の動的調整（モデルのコンテキスト長に応じて変更） |
| 低 | 認証・セッション管理 |
| 低 | デプロイ構成（Docker Compose 完全版） |

---

## 7. 設計上の学び（累積追加分）

### React の非同期 state 更新に注意

`sendMessage` 内で `history` を直接 fetch body に渡すと、
state の非同期更新タイミングによって意図しない値が渡ることがある。
送信時点でスナップショットを変数に取り、そちらを使う。

### LLM の会話履歴は「最近の N ターン」に限定する

全履歴を渡すとトークン増加によって返答品質が劣化するリスクがある。
`HISTORY_LIMIT` のような定数で上限を設け、古いターンを切り捨てる設計にしておく。
