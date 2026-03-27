FROM ollama/ollama:latest

ARG OLLAMA_MODEL=llama3.2

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV OLLAMA_MODEL=${OLLAMA_MODEL}

ENTRYPOINT ["/entrypoint.sh"]
