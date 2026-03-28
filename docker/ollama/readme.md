https://zenn.dev/chushaofeng/articles/63df0e1effcf1d

# 動作確認

```
  # 起動確認
  curl http://localhost:11434/

  # モデル一覧（pullされているか確認）
  curl http://localhost:11434/api/tags

  # バージョン確認
  curl http://localhost:11434/api/version
```

# 試したモデル

| モデル      | 結果                 |
| ----------- | -------------------- |
| llama3.2    | 回答が不自然         |
| qwen2.5:7b  | 回答に中国語が混ざる |
| gpt-oss:20b | 回答は自然だが遅い   |
| Qwen3.5※    | 長すぎる回答         |

※:hf.co/dahara1/Qwen3.5-4B-UD-japanese-imatrix:Q4_K_M

# モデルのインストール

```
$ ./bin/bash.sh
```

```
root@478cee90d3f4:/# ollama pull hf.co/dahara1/Qwen3.5-4B-UD-japanese-imatrix:Q4_K_M
```
