#!/bin/sh
echo "🦞 Starting Reviewer Agent..."

if [ -d "/app/.git" ]; then
    cd /app && git pull
else
    git clone https://github.com/paidaxinbao/agent-swarm.git /app
    cd /app
fi

cp /root/.openclaw/workspace/SOUL.md /app/SOUL.md
cp /root/.openclaw/workspace/AGENTS.md /app/AGENTS.md

echo "Starting OpenClaw Gateway..."
openclaw gateway --port 18792 --verbose &

tail -f /dev/null