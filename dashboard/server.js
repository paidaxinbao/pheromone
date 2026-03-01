/**
 * Pheromone Dashboard Server
 * Real-time monitoring dashboard for Agent Swarm
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  port: process.env.DASHBOARD_PORT || 18890,
  mailboxUrl: 'http://localhost:18888'
};

// Simple in-memory cache
let cache = {
  agents: [],
  stats: null,
  messages: [],
  lastUpdate: 0
};

async function fetchFromMailbox(endpoint) {
  try {
    const url = `${CONFIG.mailboxUrl}${endpoint}`;
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    console.error(`Error fetching ${endpoint}:`, err.message);
    return null;
  }
}

async function updateCache() {
  const now = Date.now();
  if (now - cache.lastUpdate < 5000) return; // Cache for 5 seconds
  
  const [agentsRes, statsRes] = await Promise.all([
    fetchFromMailbox('/agents'),
    fetchFromMailbox('/stats')
  ]);
  
  if (agentsRes?.success) {
    cache.agents = agentsRes.agents || [];
  }
  
  if (statsRes?.success) {
    cache.stats = statsRes.stats;
  }
  
  cache.lastUpdate = now;
  console.log(`Dashboard cache updated: ${cache.agents.length} agents`);
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
  console.log(`║   Pheromone Dashboard                  ║`);
  console.log(`║   http://localhost:${CONFIG.port}            ║`);
  console.log(`║   Mailbox: ${CONFIG.mailboxUrl}       ║`);
  console.log(`╚════════════════════════════════════════╝`);
});

// Update cache every 10 seconds
setInterval(updateCache, 10000);