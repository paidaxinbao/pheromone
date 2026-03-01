#!/bin/bash
set -e

echo "=== Starting Agent: ${AGENT_ID} (${AGENT_ROLE}) ==="
echo "Hub URL: ${HUB_URL}"
echo "Callback Port: ${CALLBACK_PORT:-9000}"
echo "OpenClaw URL: ${OPENCLAW_URL:-http://localhost:18789}"

# Start callback server (background)
echo ""
echo "Starting callback server..."
node /app/callback-server/server.js &
CALLBACK_PID=$!
echo "  Callback Server PID: ${CALLBACK_PID}"

# Wait for callback server to be ready
sleep 3

# Start OpenClaw Agent (foreground)
echo ""
echo "Starting OpenClaw Agent..."
echo "  Skills directory: /app/pheromone-skill"
echo "  Port: ${OPENCLAW_PORT:-18789}"

# OpenClaw Agent startup command
# Adjust based on actual OpenClaw CLI syntax
openclaw agent start \
  --id "${AGENT_ID}" \
  --role "${AGENT_ROLE}" \
  --skills-dir /app/pheromone-skill \
  --port "${OPENCLAW_PORT:-18789}" \
  --verbose &
OPENCLAW_PID=$!
echo "  OpenClaw PID: ${OPENCLAW_PID}"

echo ""
echo "=== Agent ${AGENT_ID} started ==="
echo ""

# Wait for either process to exit
wait -n $CALLBACK_PID $OPENCLAW_PID
EXIT_CODE=$?

echo ""
echo "=== Agent ${AGENT_ID} exiting (code: ${EXIT_CODE}) ==="

# Cleanup
kill $CALLBACK_PID $OPENCLAW_PID 2>/dev/null || true
exit $EXIT_CODE
