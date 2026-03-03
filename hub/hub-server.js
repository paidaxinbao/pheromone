/**
 * Simple Hub Server for Docker Testing
 */

const http = require('http');

const agents = new Map();
const messages = [];

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const JSON_TYPE = { 'Content-Type': 'application/json; charset=utf-8' };
  
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, JSON_TYPE);
    res.end(JSON.stringify({
      success: true,
      status: 'healthy',
      uptime: process.uptime(),
      agents: agents.size,
      messages: messages.length
    }));
    return;
  }
  
  // Register agent
  if (req.method === 'POST' && req.url === '/register') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const agent = data.agent;
        agents.set(agent.id, {
          ...agent,
          registeredAt: new Date().toISOString(),
          lastHeartbeat: Date.now(),
          status: 'idle'
        });
        console.log('✅ Agent registered:', agent.id);
        res.writeHead(200, JSON_TYPE);
        res.end(JSON.stringify({ success: true, agentId: agent.id }));
      } catch (error) {
        res.writeHead(400, JSON_TYPE);
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }
  
  // Heartbeat
  if (req.method === 'POST' && req.url === '/heartbeat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const agent = agents.get(data.agentId);
        if (agent) {
          agent.lastHeartbeat = Date.now();
          agent.status = data.status || 'idle';
        }
        res.writeHead(200, JSON_TYPE);
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(400, JSON_TYPE);
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }
  
  // Send message
  if (req.method === 'POST' && req.url === '/message') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const message = JSON.parse(body);
        messages.unshift(message);
        if (messages.length > 100) messages.pop();
        console.log(`📬 Message from ${message.sender.id} to ${message.recipient?.id || 'broadcast'}`);
        res.writeHead(200, JSON_TYPE);
        res.end(JSON.stringify({ success: true, messageId: message.id }));
      } catch (error) {
        res.writeHead(400, JSON_TYPE);
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }
  
  // Get messages
  if (req.method === 'GET' && req.url.startsWith('/messages')) {
    const url = new URL(req.url, 'http://localhost:18888');
    const limit = parseInt(url.searchParams.get('limit')) || 20;
    res.writeHead(200, JSON_TYPE);
    res.end(JSON.stringify({ success: true, messages: messages.slice(0, limit) }));
    return;
  }
  
  // Get agents
  if (req.method === 'GET' && req.url === '/agents') {
    res.writeHead(200, JSON_TYPE);
    res.end(JSON.stringify({ success: true, agents: Array.from(agents.values()) }));
    return;
  }
  
  // 404
  res.writeHead(404, JSON_TYPE);
  res.end(JSON.stringify({ success: false, error: 'Not found' }));
});

server.listen(18888, () => {
  console.log('🚀 Hub Server running on port 18888');
});
