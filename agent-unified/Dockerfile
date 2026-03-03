# Pheromone Unified Agent
# 统一镜像模板，通过环境变量区分不同角色

FROM node:22-bookworm-slim

# 安装 git（OpenClaw 需要）
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# 安装 OpenClaw
RUN npm install -g openclaw@latest

# 安装 http-server（用于回调服务器）
RUN npm install -g http-server

WORKDIR /app

# 复制回调服务器代码
COPY callback-server/ /app/callback-server/

# 复制启动脚本
COPY startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

# 环境变量（运行时指定）
ENV AGENT_ID=agent
ENV AGENT_ROLE=assistant
ENV HUB_URL=http://hub:18888
ENV CALLBACK_PORT=9000

# 暴露回调端口
EXPOSE 9000

# 启动脚本
CMD ["/app/startup.sh"]
