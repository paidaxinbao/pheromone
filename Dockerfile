# OpenClaw Agent Swarm - 基于官方 Dockerfile
# 参考：https://docs.openclaw.ai/install/docker

FROM node:22-bookworm-slim

# 安装必要依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 启用 corepack (pnpm)
RUN corepack enable

WORKDIR /app

# 安装 OpenClaw
RUN npm install -g openclaw@latest

# 创建非 root 用户
RUN useradd -m -u 1000 node

# 创建工作目录
RUN mkdir -p /home/node/workspace && chown -R node:node /home/node

USER node

WORKDIR /home/node/workspace

# 默认命令
CMD ["gateway", "--port", "18789", "--verbose", "--allow-unconfigured"]