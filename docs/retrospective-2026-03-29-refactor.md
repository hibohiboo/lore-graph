# 振り返りレポート — lore-graph リファクタリング（README 整合・dead code 削除・型共有）

作成日: 2026-03-29

---

## 1. 概要

前セッションで完成した Fact-first アーキテクチャに対して、
実装と README の乖離・dead code・型の重複という3つの技術的負債を解消するリファクタリングを実施した。

---

## 2. やったこと

### 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `README.md` | アーキテクチャ図・パッケージ構成を実態に合わせて更新。初期構想は「将来のアーキテクチャ構想」セクションとして保存 |
| `packages/schema/src/fact.ts` | `FactRecordSchema`・`FactRecord` 型を追加 |
| `packages/graph-db/src/npc-facts.ts` | `FactRecordSchema` を `@repo/schema` から import に変更。`getFactsByNpc()` を追加 |
| `packages/graph-db/src/index.ts` | `getFactsByNpc` をエクスポートに追加 |
| `apps/backend/src/services/llm.ts` | `extractFacts()` dead code を削除 |
| `apps/backend/src/routes/seed.ts` | `GET /` を `getFactsByNpc` 使用に変更し `FactRecord[]` を返すよう統一 |
| `apps/game-client/src/hooks/useSeed.ts` | `worldFacts` を `FactRecord[]` に変更。文字列パースによる削除処理を撤廃 |
| `apps/game-client/src/components/SeedPanel.tsx` | 世界設定一覧を文字列リストからテーブル表示に変更 |
| `apps/game-client/src/hooks/useFactList.ts` | `FactRecord` 型を `@repo/schema` から import に変更 |

### 修正した問題

#### 1. README と実装の乖離

README のアーキテクチャ図と `packages/` 構成に、実在しないパッケージ（`llm-adapter`・`lore-engine`・`npc-mind`）が記載されていた。
また `packages/schema` が記載されていなかった。

→ 現在の実装に合わせて更新。初期構想は「将来のアーキテクチャ構想」セクションとして残した。

#### 2. `extractFacts()` dead code

Fact-first アーキテクチャ移行後、`apps/backend/src/services/llm.ts` の `extractFacts()` は
どこからも呼ばれていなかった（`conversation.ts` は `generateFactsFromQuestion` を使用）。

→ 削除。

#### 3. `GET /api/seed` のレスポンス形式の不統一

- `GET /api/seed` → `{ facts: string[] }`（`getNpcFacts` の文字列出力をそのまま返却）
- `GET /api/facts` → `{ facts: FactRecord[] }`（構造化データ）

`useSeed.ts` の `deleteFact` が `"subject predicate object (certainty:X.X)"` を
手動の文字列パース（`indexOf + split`）で分解して削除キーを取り出していた。
predicate や object に空白が含まれる場合に壊れる脆弱な実装だった。

→ `getFactsByNpc()` を追加し `GET /api/seed` が `FactRecord[]` を返すよう統一。
  フロントエンドは構造化データをそのまま渡して削除できるようになった。

#### 4. `FactRecordSchema` の重複定義

`packages/graph-db`・`apps/game-client/src/hooks/useSeed.ts`・`apps/game-client/src/hooks/useFactList.ts`
の3箇所で同一内容の `FactRecordSchema` が定義されていた。

→ `packages/schema/src/fact.ts` に一元化し、各パッケージが `@repo/schema` から import する構成に変更。
  フロントエンドからは `@repo/graph-db` を直接 import しない（バックエンドパッケージへの依存を避ける）。

---

## 3. 技術選定の判断

### `FactRecordSchema` の置き場所を `@repo/schema` にした理由

フロントエンドからバックエンドパッケージ（`@repo/graph-db`）を直接 import することは
責務の境界を越えるため避けるべき。
`@repo/schema` はフロントエンド・バックエンド・graph-db のいずれからも参照される中立パッケージであり、
共有型の置き場所として適切。

### `getFactsByNpc()` を `getAllFacts()` と分けた理由

`getAllFacts()` はグラフ全体を返す（`FactListPanel` 用）。
`getFactsByNpc()` は特定 NPC の BELIEVES リレーションを経由してフィルタする（`SeedPanel` 用）。
クエリの意味・用途・返却範囲が異なるため別関数として分離した。

---

## 4. 実装して良かったこと

### 文字列パースの完全撤廃

`useSeed.ts` の `deleteFact` が文字列を手動パースしていた箇所を、
構造化データ `FactRecord` をそのまま渡す形に変更できた。
`predicate` や `object` に空白が混入しても壊れない堅牢な実装になった。

### README の現在・将来の分離

現状の実装図と将来構想の5層アーキテクチャ図を別セクションとして共存させた。
「現在どうなっているか」と「どこを目指しているか」が一目で分かる構成になった。

---

## 5. 苦労したこと・課題

### フロントエンドからバックエンドパッケージへの import

最初 `useFactList.ts`・`useSeed.ts` に `@repo/graph-db` からの import を入れたが、
フロントエンドからバックエンドパッケージを直接参照することへの指摘で修正。
`@repo/schema` への移動で解決した。

→ **教訓**: 型の共有先は依存方向を考慮して選ぶ。フロントエンドが参照できるのは `@repo/schema` のような中立パッケージのみ。

---

## 6. 今後やること（前セッションからの継続）

| 優先度 | 内容 |
|---|---|
| 高 | **会話履歴の表示**（現状は直前の返答のみ。ゲームとして成立しない） |
| 高 | **複数NPC対応**（NPC選択 UI。現状は酒場の娘固定） |
| 中 | **NPC固有ペルソナ設定**（口調・知識範囲の個別定義） |
| 中 | **グラフ可視化**（知識グラフをビジュアルで確認） |
| 低 | 認証・セッション管理 |
| 低 | デプロイ構成（Docker Compose 完全版） |

---

## 7. 設計上の学び（累積追加分）

### 型の共有先は依存方向を考慮する

`FactRecord` のような型を共有する場合、フロントエンドがバックエンドパッケージを import するのは NG。
中立パッケージ（`@repo/schema`）に定義し、全パッケージがそこから import する。

### API レスポンスの形式は早期に構造化する

`string[]` で返していたレスポンスを後から `FactRecord[]` に変える際、
フロントエンドの削除ロジック・表示ロジック・スキーマの3箇所を同時に変更する必要があった。
最初から構造化データで返す設計にしておくとリファクタリングコストが下がる。
