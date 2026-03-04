#!/bin/bash
# Start Pheromone Hub v3 for testing

echo "🚀 Starting Pheromone Hub v3..."
echo ""

# Navigate to mailbox directory
cd "$(dirname "$0")/mailbox"

# Start Hub v3
echo "Starting hub-v3.js on port 18888..."
node hub-v3.js
