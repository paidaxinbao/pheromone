# Developer Agent - OpenClaw 容器
FROM node:20-alpine

# 安装 Git 和必要工具
RUN apk add --no-cache git openssh-client curl

# 创建工作目录
WORKDIR /app

# 安装 OpenClaw
RUN npm install -g openclaw@latest

# 创建 Agent 工作空间
WORKDIR /root/.openclaw/workspace

# 复制 Agent 配置
COPY agents/developer/SOUL.md ./SOUL.md
COPY agents/developer/AGENTS.md ./AGENTS.md
COPY agents/developer/TOOLS.md ./TOOLS.md 2>/dev/null || echo "# Tools config" > ./TOOLS.md

# 创建记忆目录
RUN mkdir -p memory

# 配置 OpenClaw
RUN echo '{"agent":{"model":"bailian/qwen3.5-plus"}}' > /root/.openclaw/openclaw.json

# 启动脚本
COPY docker/agent-developer/start.sh /start.sh
RUN chmod +x /start.sh

# 挂载 GitHub 项目
VOLUME ["/app"]

# 工作目录
WORKDIR /app

CMD ["/start.sh"]