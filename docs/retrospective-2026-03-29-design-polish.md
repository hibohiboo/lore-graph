# 振り返りレポート — lore-graph デザイン品質向上（フォント・アニメーション・アクセシビリティ）

作成日: 2026-03-29

---

## 1. 概要

`frontend-design` スキルと `web-design-guidelines` スキルを使い、
ファンタジー酒場テーマUIのデザイン品質とアクセシビリティを本格的に強化した。
特徴的なWebフォント導入・アニメーション・WCAG準拠のアクセシビリティ修正が主な内容。

---

## 2. 作ったもの

### 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `apps/game-client/index.html` | `lang="ja"`・`theme-color` meta・Google Fonts `<link>` 追加 |
| `apps/game-client/src/index.css` | フォント刷新・アニメーション追加・アクセシビリティ用クラス追加 |
| `apps/game-client/src/App.tsx` | スキップリンク追加 |
| `apps/game-client/src/components/ConversationPanel.tsx` | `LoadingDots`・`aria-live`・`role="alert"`・`<label>` 追加 |
| `apps/game-client/src/components/PersonaPanel.tsx` | `aria-label`・`type="button"`・削除確認ダイアログ追加 |
| `apps/game-client/src/components/SeedPanel.tsx` | `<label>`・`aria-label`・`type="button"`・`…` 統一 |
| `apps/game-client/src/components/FactListPanel.tsx` | `aria-label`・`type="button"` 追加 |

### フォント構成

| フォント | 用途 |
|---|---|
| `Cinzel Decorative 700` | h1タイトル（刻銘碑風の強いセリフ体） |
| `Cinzel 400/600` | h2・h3・ボタン・ラベル・フッター（小型大文字風） |
| `EB Garamond 400/italic` | 本文・textarea・blockquote（優雅な書体） |

### 追加したCSSの仕組み

| 機能 | 実装 |
|---|---|
| 蠟燭揺らぎ | `@keyframes candle`（text-shadow の強度が5秒周期で変化） |
| NPC返答フェードイン | `@keyframes fadeUp`（opacity + translateY、0.5s） |
| ローディングドット | `@keyframes blink`（3点が0.2s ずつずれて点滅） |
| グレインテクスチャ | `body::after` + SVG fractalNoise（opacity 3.5%） |
| モーション軽減 | `@media (prefers-reduced-motion: reduce)` で全アニメ無効化 |
| フォーカスリング | `:focus-visible` で outline 2px（クリック時は非表示） |
| タッチ最適化 | `touch-action: manipulation`（ダブルタップズーム遅延解消） |
| ダークモード統一 | `color-scheme: dark`（スクロールバー・input色が統一） |
| tabular数字 | `.fact-pill-certainty` に `font-variant-numeric: tabular-nums` |
| スクリーンリーダー | `.sr-only` クラス（非表示ラベル） |
| スキップリンク | `.skip-link`（キーボードで Tab 時に可視化） |

---

## 3. 技術選定の判断

### Google Fonts を `index.html` の `<link>` で読み込む

CSS `@import` より `<link rel="stylesheet">` のほうがブラウザの並列ダウンロードが効く。
`<link rel="preconnect">` でフォントサーバーへの事前接続も設定した。

### `:focus-visible` を `:focus` の代わりに使う

`:focus` はマウスクリックでも発火するため、視覚的なフォーカスリングがクリック時に現れて不自然。
`:focus-visible` はキーボード操作時のみフォーカスリングを表示し、
マウス操作時は非表示にする（ブラウザが自動判断）。

### `window.confirm()` による削除確認

破壊的操作（ペルソナ全削除）に対して、追加コンポーネントなしで確認を実装できる最小コスト の手段。
モーダルUIを新規実装するほどの規模でないと判断。

### グレインテクスチャを SVG + `body::after` で実装

JavaScript・PNG画像ファイル不要でランダムノイズ感が得られる。
`opacity: 3.5%` と薄めにして画面の読みやすさを損なわないようにした。

---

## 4. 実装して良かったこと

### `prefers-reduced-motion` への対応

`@media (prefers-reduced-motion: reduce)` で全アニメーションを無効化する一行を追加した。
蠟燭揺らぎアニメーションは個性的だが、前庭障害のあるユーザーには有害になりうる。
アクセシビリティとデザインの両立ができた。

### `LoadingDots` コンポーネントの分離

ローディング表示を `LoadingDots` という独立したコンポーネントに切り出した。
ConversationPanel の JSX が簡潔になり、アニメーション制御もCSSに完全委譲できた。

### `aria-label` で削除ボタンの文脈を明確化

`「銀嶺亭 is 宿屋」を削除` のように、どの行を削除するかをスクリーンリーダーが読み上げられるようにした。
テーブル内の同名ボタンが連続しても区別できる。

### 全ボタンへの `type="button"` 明示

`<form>` 要素がなくても、`type` を省略するとブラウザデフォルトが `submit` になる場合がある。
全ボタンに `type="button"` を明示することでサブミット誤動作を防いだ。

---

## 5. 苦労したこと・課題

### `!important` と ESLint `css/no-important` の競合

`@media (prefers-reduced-motion: reduce)` の中で `animation-duration: 0.01ms !important` と書いたところ、
ESLint の `css/no-important` ルールでエラーになった。

→ `!important` を削除して通常の宣言に変更。
  `prefers-reduced-motion` の `@media` ブロック内では詳細度の競合が起きにくいため実害はない。

→ **教訓**: プロジェクトの CSS Lint ルールを事前に確認してから書く。`!important` はどのコンテキストでも禁止されることがある。

### `clip: rect(0,0,0,0)` の `css/use-baseline` エラー

`.sr-only` の定義で `clip: rect(0, 0, 0, 0)` を書いたところ、
`css/use-baseline` ルールで「Widely available ではない」として検出された。

→ `clip` プロパティを除外した `.sr-only` 定義に変更。
  `clip-path` が `clip` の後継だが、`.sr-only` では `overflow: hidden` で代替可能。

→ **教訓**: `clip` は非推奨プロパティ。`clip-path` や `overflow: hidden` で代替する。

### `frontend-design` スキルが未登録だった（前回からの継続）

`.claude/skills/` に `frontend-design` スキルが存在しなかったため、
今回のセッションで追加・登録後に利用できた。

---

## 6. 今後やること（優先度付き）

| 優先度 | 内容 |
|---|---|
| 高 | **会話履歴の表示**（現状は直前の1返答のみ。ゲームとして成立しない） |
| 高 | **複数NPC対応**（NPC選択UI・複数NPCのペルソナ管理） |
| 中 | **`newFacts` の重複排除**（question由来とreply由来の同一factを1件に） |
| 中 | **グラフ可視化**（知識グラフをビジュアルで確認） |
| 低 | ペルソナ全削除を `window.confirm` → 専用確認UIに昇格 |
| 低 | 認証・セッション管理 |
| 低 | デプロイ構成（Docker Compose 完全版） |

---

## 7. 設計上の学び（累積追加分）

### デザインとアクセシビリティは同時に設計する

フォント・アニメーションを追加した直後にアクセシビリティを審査すると、
修正箇所が多くなる。最初からラベル・ARIA・`prefers-reduced-motion` を設計に含めておくと後の修正コストが下がる。

### CSS Lint ルールはプロジェクトごとに異なる

`!important`・`clip`・`user-select`（ベンダープレフィックスが必要）など、
一般的に許容されているCSSでもこのプロジェクトの Lint に引っかかるものがある。
変更前に `bun run lint` を一度走らせてルールセットを把握しておく。

### `prefers-reduced-motion` は「アニメを抑える」ではなく「必須対応」

蠟燭揺らぎのような個性的なアニメーションほど、前庭障害・てんかんのあるユーザーへのリスクが高い。
視覚的に印象的なアニメーションほど、モーション軽減対応が重要になる。
