/**
 * Pheromone Dashboard Server v2
 * Real-time monitoring dashboard for Agent Swarm
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  port: process.env.DASHBOARD_PORT || 18890,
  mailboxUrl: 'http://localhost:18888'
};

// Cache
let cache = {
  agents: [],
  stats: null,
  messages: [],
  lastUpdate: 0
};

async function fetchFromMailbox(endpoint) {
  try {
    const url = `${CONFIG.mailboxUrl}${endpoint}`;
    const res = await fetch(url, { timeout: 5000 });
    return await res.json();
  } catch (err) {
    console.error(`Error fetching ${endpoint}:`, err.message);
    return null;
  }
}

async function updateCache() {
  const now = Date.now();
  if (now - cache.lastUpdate < 5000) return;
  
  console.log('Updating dashboard cache...');
  
  const [agentsRes, statsRes] = await Promise.all([
    fetchFromMailbox('/agents'),
    fetchFromMailbox('/stats')
  ]);
  
  if (agentsRes?.success) {
    cache.agents = agentsRes.agents || [];
    console.log(`  Agents: ${cache.agents.length}`);
  }
  
  if (statsRes?.success) {
    cache.stats = statsRes.stats;
  }
  
  // Fetch messages from all agents
  cache.messages = [];
  if (agentsRes?.success && agentsRes.agents) {
    for (const agent of agentsRes.agents) {
      const msgRes = await fetchFromMailbox(`/messages?agentId=${agent.id}`);
      if (msgRes?.success && msgRes.messages) {
        cache.messages.push(...msgRes.messages);
      }
    }
    // Sort by newest first
    cache.messages.sort((a, b) => (b._enqueuedAt || 0) - (a._enqueuedAt || 0));
    console.log(`  Messages: ${cache.messages.length}`);
  }
  
  cache.lastUpdate = now;
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${CONFIG.port}`);
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // API endpoints
  if (url.pathname === '/api/agents') {
    await updateCache();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, agents: cache.agents }));
    return;
  }
  
  if (url.pathname === '/api/stats') {
    await updateCache();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, stats: cache.stats }));
    return;
  }
  
  if (url.pathname === '/api/health') {
    const health = await fetchFromMailbox('/health');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health || { success: false, error: 'Mailbox unreachable' }));
    return;
  }
  
  if (url.pathname === '/api/messages') {
    await updateCache();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, messages: cache.messages }));
    return;
  }
  
  // Serve static files
  if (url.pathname === '/' || url.pathname === '/index.html') {
    serveFile(res, path.join(__dirname, 'index.html'), 'text/html');
    return;
  }
  
  if (url.pathname === '/style.css') {
    serveFile(res, path.join(__dirname, 'style.css'), 'text/css');
    return;
  }
  
  if (url.pathname === '/app.js') {
    serveFile(res, path.join(__dirname, 'app.js'), 'application/javascript');
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

server.listen(CONFIG.port, () => {
  console.log(`╔════════════════════════════════════════╗`);
  console.log(`║   Pheromone Dashboard v2               ║`);
  console.log(`║   http://localhost:${CONFIG.port}            ║`);
  console.log(`║   Mailbox: ${CONFIG.mailboxUrl}       ║`);
  console.log(`╚════════════════════════════════════════╝`);
});

// Update cache every 10 seconds
setInterval(updateCache, 10000);

// Initial cache update
updateCache();
