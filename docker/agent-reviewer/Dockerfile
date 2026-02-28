# Reviewer Agent - OpenClaw 容器
FROM node:20-alpine

RUN apk add --no-cache git openssh-client curl
WORKDIR /app

RUN npm install -g openclaw@latest
WORKDIR /root/.openclaw/workspace

COPY agents/reviewer/SOUL.md ./SOUL.md
COPY agents/reviewer/AGENTS.md ./AGENTS.md
RUN echo "# Tools config" > ./TOOLS.md
RUN mkdir -p memory
RUN echo '{"agent":{"model":"bailian/qwen3.5-plus"}}' > /root/.openclaw/openclaw.json

COPY docker/agent-reviewer/start.sh /start.sh
RUN chmod +x /start.sh

VOLUME ["/app"]
WORKDIR /app

CMD ["/start.sh"]