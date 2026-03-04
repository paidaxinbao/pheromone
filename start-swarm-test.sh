#!/bin/bash
# Pheromone Swarm Test - Start 6 Agent processes locally

echo "🚀 Starting Pheromone Swarm (6 Agents)..."

# Hub should already be running on port 18888

# Start 6 agent processes
for i in {1..6}; do
  echo "Starting agent-$i (role-$i)..."
  node -e "
    const http = require('http');
    const agentId = 'agent-$i';
    const role = 'role-$i';
    const port = 9000 + $i;
    
    // Register with Hub
    const registerData = JSON.stringify({
      agent: {
        id: '$agentId',
        role: '$role',
        callbackUrl: 'http://localhost:$port/callback'
      }
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: 18888,
      path: '/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(registerData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('✅ Agent $i registered:', body);
        
        // Start callback server
        const server = http.createServer((req, res) => {
          if (req.url === '/callback' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              console.log('[$agentId] Received:', JSON.parse(body).payload?.content || 'message');
              res.writeHead(200);
              res.end('OK');
            });
          } else {
            res.writeHead(404);
            res.end();
          }
        });
        
        server.listen($port, () => {
          console.log('✅ Agent $i callback server on port $port');
        });
      });
    });
    
    req.on('error', (e) => console.error('❌ Agent $i error:', e.message));
    req.write(registerData);
    req.end();
  " &
done

echo "✅ All 6 agents starting..."
wait
