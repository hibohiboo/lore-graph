FROM ollama/ollama:latest

ARG OLLAMA_MODEL=qwen2.5:7b

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV OLLAMA_MODEL=${OLLAMA_MODEL}

ENTRYPOINT ["/entrypoint.sh"]
