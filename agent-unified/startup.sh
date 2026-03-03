#!/bin/bash
# Pheromone Agent 启动脚本

echo "=== Starting Agent: $AGENT_ID ($AGENT_ROLE) ==="
echo "Hub URL: $HUB_URL"
echo "Callback Port: $CALLBACK_PORT"

# 设置 OpenClaw 环境变量
export OPENCLAW_CONFIG=/app/workspace/openclaw.json
export OPENCLAW_WORKSPACE=/app/workspace

# 创建 OpenClaw 目录结构并复制配置
mkdir -p /root/.openclaw/agents/$AGENT_ID/agent
cp /app/workspace/openclaw.json /root/.openclaw/openclaw.json

# 创建 auth-profiles.json（使用 bailian API key）
cat > /root/.openclaw/agents/$AGENT_ID/agent/auth-profiles.json << 'EOF'
{
  "bailian": "sk-sp-d36c1563ce344c91bc3fb8d1751ecc4b"
}
EOF

echo "OpenClaw config: $OPENCLAW_CONFIG"
echo "OpenClaw workspace: $OPENCLAW_WORKSPACE"

# 启动回调服务器
echo ""
echo "Starting callback server..."
cd /app/callback-server
node server.js &
CALLBACK_PID=$!

echo "  Callback Server PID: $CALLBACK_PID"
echo ""
echo "=== Agent $AGENT_ID started ==="

# 保持容器运行
wait $CALLBACK_PID
