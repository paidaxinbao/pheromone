#!/bin/sh
# Developer Agent 启动脚本

echo "🦞 Starting Developer Agent..."

# 克隆/更新 GitHub 项目
if [ -d "/app/.git" ]; then
    cd /app && git pull
else
    git clone https://github.com/paidaxinbao/agent-swarm.git /app
    cd /app
fi

# 同步工作空间配置
cp /root/.openclaw/workspace/SOUL.md /app/SOUL.md
cp /root/.openclaw/workspace/AGENTS.md /app/AGENTS.md

# 启动 OpenClaw Gateway
echo "Starting OpenClaw Gateway..."
openclaw gateway --port 18791 --verbose &

# 保持容器运行
tail -f /dev/null