#!/bin/sh
set -e

# サーバーをバックグラウンドで起動
ollama serve &
SERVER_PID=$!

# サーバーが起動するまで待機
echo "Waiting for Ollama server..."
until ollama list > /dev/null 2>&1; do
  sleep 1
done

# モデルをpull（すでに存在する場合はスキップ）
echo "Pulling model: ${OLLAMA_MODEL}"
ollama pull "${OLLAMA_MODEL}"
echo "Model ready: ${OLLAMA_MODEL}"

# サーバープロセスにフォアグラウンドで待機
wait $SERVER_PID
