# Lore Graph

> 酒場で集めた断片的な噂をつなぎ合わせ、世界が少しずつ姿を現すナラティブ探索ゲーム。

---

## 概要

lore-graph は、NPCとの会話を通じて世界の理解を深めていくナラティブ探索ゲームです。

プレイヤーは酒場に集う冒険者や住人から噂話を聞き出します。  
それらの情報は断片的で、不完全であり、時には矛盾しています。

本プロジェクトでは、それらの情報を単なるテキストとして扱うのではなく、  
構造化された「知識」として蓄積し、グラフとして接続していきます。

プレイヤーは徐々に情報をつなぎ合わせ、曖昧だった世界像を明確にしていきます。

---

## 主要コンセプト

### 断片的な知識

全体像を把握している NPC は存在しません。各会話から得られるのは、名前・噂・うろ覚えの出来事といった情報の欠片です。
プレイヤーは複数の情報を組み合わせて理解を深めていきます。

### 噂と事実

NPC が語るのは「信じていること」であり、「真実」ではありません。発言は構造化された世界モデルをもとに生成されますが、そのキャラクターの知識や視点を通してフィルタリングされます。
**会話はあくまで知識の表現であり、真実そのものではありません。**

### 知識グラフ

抽出されたすべての情報は、エンティティと関係からなるグラフとして蓄積されます。新たな情報が加わるたびにグラフは更新され、矛盾は暗黙に解消されるのではなく、明示的に追跡されます。

### NPC による探索

NPC はストーリーを説明するのではなく、自分が理解している世界を反映します。適切な相手に話しかけること、あるいは同じ相手と複数回会話することで、グラフに新たなノードが追加され、隠れた関係が浮かび上がります。

---

## アーキテクチャ

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
                            [Neo4j] ←→ [OpenAI / Ollama]
```

- **backend** — Hono REST API。LLM 呼び出し・グラフ書き込みのオーケストレーションを担当します。
- **graph-db** — Neo4j クライアントのラッパー。Fact の読み書き・削除クエリを提供します。
- **Game Client** — React + Vite のプレイヤー向けUI。会話・世界設定登録・Fact 管理を行います。

---

## モノレポ構成

各パッケージは責務ごとに分離されており、拡張性とテスト容易性を重視しています。

```
lore-graph/
├── apps/
│   ├── game-client/       # フロントエンドのゲームUI（React + Vite）
│   └── backend/           # API サーバー・オーケストレーション層（Hono）
├── docker/                # バックエンド用Docker
│   └── neo4j/             # Neo4j graphdb
└── packages/
    ├── graph-db/          # Neo4j クライアント・Fact CRUD
    └── schema/            # Zod 共有スキーマ
```

| パッケージ    | 役割                                                                       |
| ------------- | -------------------------------------------------------------------------- |
| `graph-db`    | Neo4j クライアントのラッパー。Fact の読み書き・削除クエリを提供            |
| `schema`      | Zod スキーマの共有定義（`ExtractedFact` 等）                               |
| `game-client` | プレイヤーUI・会話・世界設定登録・Fact 管理                                |
| `backend`     | REST API・LLM 呼び出し・グラフ書き込みのオーケストレーション               |

---

## はじめかた

> セットアップ手順は順次整備予定です。現在は初期開発段階です。

```bash
# リポジトリをクローン
git clone https://github.com/your-org/lore-graph.git
cd lore-graph

# 依存関係をインストール
bun install

# 環境変数を設定
cp .env.example .env
# OPENAI_API_KEY または OLLAMA_BASE_URL を設定

# 開発サーバーを起動
bun run dev
```

**前提条件:** Node.js 20+、Bun、Neo4j（ローカルまたはクラウド）、OpenAI API キーまたは起動済みの Ollama インスタンス

---

## 設計思想

## Philosophy

- 会話は真実ではない。真実は構造の中にある。
- 世界は最初から完成していない。探索によって構築される。
- 知識は断片から生まれ、つながりによって意味を持つ。
