/**
 * Pheromone Dashboard - Client Application v2
 */

const API_BASE = '';
const UPDATE_INTERVAL = 10000; // 10 seconds

// Format uptime
function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}

// Format timestamp
function formatTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Get role color
function getRoleColor(role) {
  const colors = {
    manager: '#00d9ff',
    developer: '#00ff88',
    reviewer: '#ffa502',
    tester: '#ff6b6b',
    coordinator: '#667eea'
  };
  return colors[role] || '#888';
}

// Render agents
function renderAgents(agents) {
  const grid = document.getElementById('agent-grid');
  
  if (!agents || agents.length === 0) {
    grid.innerHTML = '<p class="empty">No agents registered</p>';
    return;
  }
  
  grid.innerHTML = agents.map(agent => `
    <div class="agent-card">
      <h3>
        <span class="agent-status-indicator status-online"></span>
        ${agent.id}
        <span class="agent-role" style="background: ${getRoleColor(agent.role)}20; color: ${getRoleColor(agent.role)}">
          ${agent.role}
        </span>
      </h3>
      <div class="agent-info">
        <div class="info-row">
          <span class="label">Status</span>
          <span class="value">${agent.status || 'idle'}</span>
        </div>
        <div class="info-row">
          <span class="label">Registered</span>
          <span class="value">${formatTime(agent.registeredAt)}</span>
        </div>
        <div class="info-row">
          <span class="label">Last Heartbeat</span>
          <span class="value">${formatTime(new Date(agent.lastHeartbeat).toISOString())}</span>
        </div>
        ${agent.currentTask ? `
        <div class="info-row">
          <span class="label">Current Task</span>
          <span class="value">${agent.currentTask}</span>
        </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// Render stats
function renderStats(stats) {
  if (!stats) return;
  
  document.getElementById('stat-total-agents').textContent = stats.agents?.total || 0;
  document.getElementById('stat-online').textContent = stats.agents?.byStatus?.online || 0;
  document.getElementById('stat-total-messages').textContent = stats.messages?.total || 0;
  
  const byRole = stats.agents?.byRole || {};
  const roleText = Object.entries(byRole)
    .map(([role, count]) => `${role}: ${count}`)
    .join(', ');
  document.getElementById('stat-messages-by-role').textContent = roleText || '-';
}

// Render messages
function renderMessages(messages) {
  const log = document.getElementById('message-log');
  
  if (!messages || messages.length === 0) {
    log.innerHTML = '<p class="empty">💬 No messages yet. Messages will appear here when agents communicate.</p>';
    return;
  }
  
  log.innerHTML = messages.map(msg => {
    // Get full message content
    const subject = msg.payload?.subject || '';
    const content = msg.payload?.content || msg.payload?.message || msg.payload?.description || '';
    const taskId = msg.payload?.taskId || '';
    const progress = msg.payload?.progress ? ` (${msg.payload.progress}%)` : '';
    const status = msg.payload?.status || '';
    
    // Build full content display
    let fullContent = '';
    if (subject) fullContent += `<strong>${escapeHtml(subject)}</strong><br>`;
    if (content) fullContent += `<div style="margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">${escapeHtml(content)}</div>`;
    if (taskId) fullContent += `<div style="margin-top: 8px; font-size: 0.85em; color: #888;">Task: ${escapeHtml(taskId)}${progress} ${status ? `• ${status}` : ''}</div>`;
    
    // If no content, show payload as JSON
    if (!fullContent) {
      fullContent = `<code style="font-size: 0.85em;">${escapeHtml(JSON.stringify(msg.payload, null, 2))}</code>`;
    }
    
    return `
      <div class="message-item">
        <div class="message-header">
          <span class="message-type">${msg.type}</span>
          <span class="message-time">${formatTime(msg.timestamp)}</span>
        </div>
        <div class="message-body" style="margin-top: 10px;">
          ${fullContent}
        </div>
        <div class="message-sender" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
          <strong>From:</strong> ${msg.sender?.id} (${msg.sender?.role}) → 
          <strong>To:</strong> ${msg.recipient?.id || 'broadcast'} (${msg.recipient?.role || 'all'})
        </div>
      </div>
    `;
  }).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update hub health
async function updateHubHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    
    if (data.success) {
      document.getElementById('hub-status').textContent = '● Online';
      document.getElementById('hub-status').style.color = '#00ff88';
      document.getElementById('hub-uptime').textContent = formatUptime(data.uptime || 0);
      document.getElementById('hub-agents').textContent = data.agents || 0;
      document.getElementById('hub-messages').textContent = data.messages || 0;
    } else {
      throw new Error('Hub not responding');
    }
  } catch (err) {
    document.getElementById('hub-status').textContent = '● Offline';
    document.getElementById('hub-status').style.color = '#ff4757';
    document.getElementById('hub-uptime').textContent = '-';
    document.getElementById('hub-agents').textContent = '-';
    document.getElementById('hub-messages').textContent = '-';
  }
}

// Update agents
async function updateAgents() {
  try {
    const res = await fetch(`${API_BASE}/api/agents`);
    const data = await res.json();
    
    if (data.success) {
      renderAgents(data.agents);
    }
  } catch (err) {
    console.error('Failed to update agents:', err);
  }
}

// Update stats
async function updateStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    const data = await res.json();
    
    if (data.success) {
      renderStats(data.stats);
    }
  } catch (err) {
    console.error('Failed to update stats:', err);
  }
}

// Update messages
async function updateMessages() {
  try {
    const res = await fetch(`${API_BASE}/api/messages`);
    const data = await res.json();
    
    if (data.success) {
      renderMessages(data.messages);
    }
  } catch (err) {
    console.error('Failed to update messages:', err);
  }
}

// Update last update time
function updateLastUpdate() {
  const now = new Date();
  document.getElementById('last-update').textContent = 
    `Last update: ${now.toLocaleTimeString('zh-CN')}`;
}

// Main update function
async function updateDashboard() {
  await Promise.all([
    updateHubHealth(),
    updateAgents(),
    updateStats(),
    updateMessages()
  ]);
  updateLastUpdate();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('🐜 Pheromone Dashboard v2 initialized');
  
  // Initial update
  updateDashboard();
  
  // Periodic updates
  setInterval(updateDashboard, UPDATE_INTERVAL);
});
