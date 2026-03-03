#!/bin/bash
set -e

echo "=== Starting Agent: ${AGENT_ID} (${AGENT_ROLE}) ==="
echo "Hub URL: ${HUB_URL}"
echo "Callback Port: ${CALLBACK_PORT:-9000}"

# Start callback server (background)
echo ""
echo "Starting callback server..."
node /app/callback-server/server.js &
CALLBACK_PID=$!
echo "  Callback Server PID: ${CALLBACK_PID}"

echo ""
echo "=== Agent ${AGENT_ID} started ==="
echo ""

# Wait for callback server to exit
wait $CALLBACK_PID
EXIT_CODE=$?

echo ""
echo "=== Agent ${AGENT_ID} exiting (code: ${EXIT_CODE}) ==="
exit $EXIT_CODE
