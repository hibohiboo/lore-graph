# docker/neo4j

[neo4j - dockerhub](https://hub.docker.com/_/neo4j)

Neo4j をローカルで起動するための Docker 構成です。

## 起動

```bash
cd docker/neo4j
docker-compose up
```

または `packages/graph-db` から:

```bash
bun run local:graphdb
```

## 接続情報

| 項目       | 値                             |
| ---------- | ------------------------------ |
| Browser UI | http://localhost:7474/browser/ |
| Bolt URI   | `bolt://localhost:7687`        |
| ユーザー名 | `neo4j`                        |
| パスワード | `neo4jpassword`                |

ポートマッピング:

| ポート | 用途                  |
| ------ | --------------------- |
| `7474` | HTTP（Neo4j Browser） |
| `7687` | Bolt プロトコル       |

## bin スクリプト

| スクリプト                          | 説明                   |
| ----------------------------------- | ---------------------- |
| `bin/up.sh`                         | docker-compose を起動  |
| `bin/container_build.sh`            | コンテナをビルド       |
| `bin/remove_all_container.sh`       | 全コンテナを削除       |
| `bin/image_remove_all_images.sh`    | 全イメージを削除       |
| `bin/image_remove_nontag-images.sh` | タグなしイメージを削除 |

# コマンド

## 全削除

```
MATCH (n) DETACH DELETE n
```
