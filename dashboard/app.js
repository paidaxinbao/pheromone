/**
 * Pheromone Dashboard v3.2
 * Minimalist Landing Page + Fixed Swarm Visualization
 */

const API_BASE = 'http://localhost:18888';
let agents = [];
let messages = [];
let swarmVisible = false;
let canvas, ctx;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🐜 Pheromone Dashboard v3.2 initialized');
  
  // Initial data fetch
  updateDashboard();
  
  // Periodic updates
  setInterval(updateDashboard, 10000);
  
  // Real-time messages
  setInterval(fetchNewMessages, 3000);
  
  // Initialize canvas
  initCanvas();
});

// ============================================================================
// Navigation
// ============================================================================

function enterDashboard() {
  document.getElementById('landing-page').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  updateDashboard();
}

function exitDashboard() {
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('landing-page').style.display = 'flex';
}

function toggleSwarm() {
  swarmVisible = !swarmVisible;
  const section = document.getElementById('swarm-section');
  section.style.display = swarmVisible ? 'block' : 'none';
  
  if (swarmVisible) {
    resizeCanvas();
    drawSwarm();
  }
}

// ============================================================================
// Dashboard Update
// ============================================================================

async function updateDashboard() {
  try {
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    const agentsData = await fetch(`${API_BASE}/agents`).then(r => r.json());
    
    agents = agentsData.agents || [];
    
    // Update landing page
    document.getElementById('landing-hub-status').textContent = '●';
    document.getElementById('landing-hub-status').style.color = '#00ff88';
    document.getElementById('landing-agents').textContent = health.agents;
    document.getElementById('landing-messages').textContent = health.messages;
    
    // Update dashboard
    document.getElementById('hub-status').innerHTML = `
      <span class="dot online"></span>
      <span>在线</span>
    `;
    document.getElementById('hub-uptime').textContent = formatUptime(health.uptime);
    document.getElementById('agent-count').textContent = health.agents;
    document.getElementById('message-count').textContent = health.messages;
    
    // Update agent list
    renderAgentList(agents);
    
    // Update last update time
    document.getElementById('last-update').textContent = `更新于 ${new Date().toLocaleTimeString('zh-CN')}`;
    
    // Redraw swarm if visible
    if (swarmVisible) {
      drawSwarm();
    }
  } catch (error) {
    console.error('Update failed:', error);
    document.getElementById('landing-hub-status').style.color = '#ff4757';
  }
}

async function fetchNewMessages() {
  try {
    const data = await fetch(`${API_BASE}/messages/history?limit=10`).then(r => r.json());
    messages = data.messages || [];
    renderMessages(messages);
  } catch (error) {
    console.error('Fetch messages failed:', error);
  }
}

// ============================================================================
// Rendering
// ============================================================================

function renderAgentList(agents) {
  const list = document.getElementById('agent-list');
  if (!list) return;
  
  if (!agents || agents.length === 0) {
    list.innerHTML = '<div class="empty">暂无 Agent</div>';
    return;
  }
  
  list.innerHTML = agents.map(agent => `
    <div class="agent-item">
      <span>${agent.id}</span>
      <span class="agent-role">${agent.role}</span>
    </div>
  `).join('');
}

function renderMessages(messages) {
  const list = document.getElementById('message-list');
  const preview = document.getElementById('message-preview');
  if (!list && !preview) return;
  
  if (!messages || messages.length === 0) {
    if (list) list.innerHTML = '<div class="empty">暂无消息</div>';
    if (preview) preview.innerHTML = '<div class="empty">暂无消息</div>';
    return;
  }
  
  // Full list
  if (list) {
    list.innerHTML = messages.map(msg => `
      <div class="message-item">
        <div class="message-header">
          <span class="message-type">${msg.type.replace('.', ' ')}</span>
          <span class="message-time">${formatTime(msg.timestamp)}</span>
        </div>
        <div class="message-body">
          <strong>${escapeHtml(msg.sender?.id || 'unknown')}</strong>
          ${msg.recipient?.id ? ` → ${escapeHtml(msg.recipient.id)}` : ' → 📢'}
          ${msg.payload?.subject ? `<br><em>${escapeHtml(msg.payload.subject)}</em>` : ''}
          ${msg.payload?.content ? `<br>${escapeHtml(msg.payload.content)}` : ''}
        </div>
        <div class="message-sender">ID: ${msg.id}</div>
      </div>
    `).join('');
  }
  
  // Preview (landing page)
  if (preview) {
    preview.innerHTML = messages.slice(0, 5).map(msg => `
      <div class="message-item-mini">
        <strong>${escapeHtml(msg.sender?.id || 'unknown')}</strong>
        ${msg.recipient?.id ? `→ ${escapeHtml(msg.recipient.id)}` : '→ 📢'}
        <br>
        <small>${escapeHtml(msg.payload?.subject || msg.payload?.title || '无主题')}</small>
      </div>
    `).join('');
  }
}

// ============================================================================
// Swarm Visualization (Fixed Position, Dynamic Size)
// ============================================================================

function initCanvas() {
  canvas = document.getElementById('swarm-canvas');
  if (!canvas) return;
  
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  if (!canvas) return;
  const container = canvas.parentElement;
  canvas.width = container.offsetWidth;
  canvas.height = 400;
}

function drawSwarm() {
  if (!ctx || !canvas) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (!agents || agents.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无 Agent', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // Calculate dynamic dot size based on agent count
  const maxDotSize = 20;
  const minDotSize = 8;
  const dotSize = Math.max(minDotSize, maxDotSize - (agents.length * 2));
  
  // Calculate grid layout
  const cols = Math.ceil(Math.sqrt(agents.length));
  const rows = Math.ceil(agents.length / cols);
  const cellWidth = canvas.width / cols;
  const cellHeight = canvas.height / rows;
  
  // Draw agents in fixed grid positions
  agents.forEach((agent, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = col * cellWidth + cellWidth / 2;
    const y = row * cellHeight + cellHeight / 2;
    
    // Draw connection lines to all other agents
    for (let j = index + 1; j < agents.length; j++) {
      const jCol = j % cols;
      const jRow = Math.floor(j / cols);
      const jX = jCol * cellWidth + cellWidth / 2;
      const jY = jRow * cellHeight + cellHeight / 2;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(jX, jY);
      ctx.strokeStyle = 'rgba(102, 126, 234, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    // Draw agent dot
    ctx.beginPath();
    ctx.arc(x, y, dotSize, 0, Math.PI * 2);
    ctx.fillStyle = getRoleColor(agent.role);
    ctx.fill();
    
    // Draw label
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(agent.id, x, y + dotSize + 15);
    
    // Draw role
    ctx.fillStyle = getRoleColor(agent.role);
    ctx.font = '10px sans-serif';
    ctx.fillText(agent.role, x, y + dotSize + 28);
  });
}

function getRoleColor(role) {
  const colors = {
    manager: '#ff6b6b',
    developer: '#00d9ff',
    reviewer: '#00ff88',
    tester: '#ffa502'
  };
  return colors[role] || '#888';
}

// ============================================================================
// Utilities
// ============================================================================

function formatUptime(seconds) {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function formatTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
