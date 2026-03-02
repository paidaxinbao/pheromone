/**
 * Pheromone Dashboard v2.0
 * Real-time monitoring and management
 */

const API_BASE = 'http://localhost:18888';
const UPDATE_INTERVAL = 10000; // 10 seconds

// Charts instances
let agentRoleChart = null;
let messageTypeChart = null;
let activityTrendChart = null;

// Data storage
let allMessages = [];
let currentFilter = 'all';

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🐜 Pheromone Dashboard v2.0 initialized');
  
  // Initialize charts
  initCharts();
  
  // Initial update
  updateDashboard();
  
  // Periodic updates
  setInterval(updateDashboard, UPDATE_INTERVAL);
  
  // Real-time message updates
  setInterval(fetchMessages, 5000);
});

// ============================================================================
// Chart Initialization
// ============================================================================

function initCharts() {
  // Agent Role Chart
  const roleCtx = document.getElementById('agent-role-chart').getContext('2d');
  agentRoleChart = new Chart(roleCtx, {
    type: 'doughnut',
    data: {
      labels: ['Manager', 'Developer', 'Reviewer', 'Tester'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: ['#ff6b6b', '#00d9ff', '#00ff88', '#ffa502']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#e4e4e4' }
        }
      }
    }
  });
  
  // Message Type Chart
  const typeCtx = document.getElementById('message-type-chart').getContext('2d');
  messageTypeChart = new Chart(typeCtx, {
    type: 'bar',
    data: {
      labels: ['Direct', 'Broadcast', 'Task', 'Update'],
      datasets: [{
        label: '消息数量',
        data: [0, 0, 0, 0],
        backgroundColor: 'rgba(102, 126, 234, 0.6)',
        borderColor: 'rgba(102, 126, 234, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#888' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        x: {
          ticks: { color: '#888' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
  
  // Activity Trend Chart
  const trendCtx = document.getElementById('activity-trend-chart').getContext('2d');
  activityTrendChart = new Chart(trendCtx, {
    type: 'line',
    data: {
      labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
      datasets: [{
        label: '活动量',
        data: [0, 0, 0, 0, 0, 0],
        borderColor: '#00ff88',
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#888' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        x: {
          ticks: { color: '#888' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// ============================================================================
// Dashboard Update
// ============================================================================

async function updateDashboard() {
  try {
    await Promise.all([
      updateHubStatus(),
      updateAgents(),
      updateCharts(),
      fetchMessages()
    ]);
    
    updateLastUpdate();
    document.getElementById('connection-status').className = 'status-indicator status-online';
  } catch (error) {
    console.error('Dashboard update failed:', error);
    document.getElementById('connection-status').className = 'status-indicator status-offline';
    document.getElementById('last-update').textContent = '连接失败';
  }
}

async function updateHubStatus() {
  const health = await fetch(`${API_BASE}/health`).then(r => r.json());
  
  document.getElementById('hub-status').textContent = '在线';
  document.getElementById('hub-status').className = 'value status-online';
  document.getElementById('hub-uptime').textContent = formatUptime(health.uptime);
  document.getElementById('hub-agents').textContent = health.agents;
  document.getElementById('hub-messages').textContent = health.messages;
}

async function updateAgents() {
  const agents = await fetch(`${API_BASE}/agents`).then(r => r.json());
  renderAgents(agents.agents || []);
}

async function updateCharts() {
  const [agents, messages] = await Promise.all([
    fetch(`${API_BASE}/agents`).then(r => r.json()),
    fetch(`${API_BASE}/messages/history?limit=100`).then(r => r.json())
  ]);
  
  // Update Agent Role Chart
  const roleCount = { manager: 0, developer: 0, reviewer: 0, tester: 0 };
  (agents.agents || []).forEach(agent => {
    if (roleCount[agent.role] !== undefined) {
      roleCount[agent.role]++;
    }
  });
  agentRoleChart.data.datasets[0].data = Object.values(roleCount);
  agentRoleChart.update();
  
  // Update Message Type Chart
  const typeCount = { direct: 0, broadcast: 0, task: 0, update: 0 };
  (messages.messages || []).forEach(msg => {
    if (msg.type.includes('direct')) typeCount.direct++;
    else if (msg.type.includes('broadcast')) typeCount.broadcast++;
    else if (msg.type.includes('assign')) typeCount.task++;
    else if (msg.type.includes('update')) typeCount.update++;
  });
  messageTypeChart.data.datasets[0].data = Object.values(typeCount);
  messageTypeChart.update();
}

// ============================================================================
// Rendering
// ============================================================================

function renderAgents(agents) {
  const grid = document.getElementById('agent-grid');
  
  if (!agents || agents.length === 0) {
    grid.innerHTML = '<p class="empty">暂无 Agent</p>';
    return;
  }
  
  grid.innerHTML = agents.map(agent => `
    <div class="agent-card" data-status="${agent.status}">
      <h3>
        <span class="agent-status-indicator status-${agent.status === 'offline' ? 'offline' : 'online'}"></span>
        ${agent.id}
        <span class="agent-role" style="background: ${getRoleColor(agent.role)}20; color: ${getRoleColor(agent.role)}">
          ${agent.role}
        </span>
      </h3>
      <div class="agent-info">
        <div class="info-row">
          <span class="label">状态</span>
          <span class="value">${agent.status}</span>
        </div>
        <div class="info-row">
          <span class="label">注册时间</span>
          <span class="value">${formatTime(agent.registeredAt)}</span>
        </div>
        <div class="info-row">
          <span class="label">最后心跳</span>
          <span class="value">${formatTime(new Date(agent.lastHeartbeat).toISOString())}</span>
        </div>
        ${agent.callbackUrl ? `
        <div class="info-row">
          <span class="label">Callback</span>
          <span class="value">✅</span>
        </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function fetchMessages() {
  const messages = await fetch(`${API_BASE}/messages/history?limit=50`).then(r => r.json());
  allMessages = messages.messages || [];
  renderMessages(allMessages);
}

function renderMessages(messages) {
  const log = document.getElementById('message-log');
  
  if (!messages || messages.length === 0) {
    log.innerHTML = '<p class="empty">暂无消息</p>';
    return;
  }
  
  log.innerHTML = messages.map(msg => {
    const typeLabel = msg.type.replace('.', ' ');
    return `
      <div class="message-item" data-type="${msg.type}">
        <div class="message-header">
          <span class="message-type">${typeLabel}</span>
          <span class="message-time">${formatTime(msg.timestamp)}</span>
        </div>
        <div class="message-body">
          <strong>${msg.sender?.id}</strong> 
          ${msg.recipient?.id ? `→ <strong>${msg.recipient.id}</strong>` : '→ 📢 广播'}
          <br>
          ${msg.payload?.subject ? `<em>${msg.payload.subject}</em><br>` : ''}
          ${msg.payload?.content || msg.payload?.title || JSON.stringify(msg.payload)}
        </div>
        <div class="message-sender">
          ID: ${msg.id} | 优先级：${msg.metadata?.priority || 'normal'}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// Filters & Search
// ============================================================================

function filterAgents(status) {
  const cards = document.querySelectorAll('.agent-card');
  cards.forEach(card => {
    if (status === 'all' || card.dataset.status === status) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

function filterMessages() {
  const type = document.getElementById('filter-type').value;
  const cards = document.querySelectorAll('.message-item');
  cards.forEach(card => {
    if (type === 'all' || card.dataset.type === type) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

function searchMessages() {
  const query = document.getElementById('search-box').value.toLowerCase();
  const cards = document.querySelectorAll('.message-item');
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(query) ? 'block' : 'none';
  });
}

// ============================================================================
// Quick Actions
// ============================================================================

function createAgent() {
  const id = prompt('Agent ID:');
  const role = prompt('Agent Role (developer/reviewer/tester):');
  if (id && role) {
    alert(`[牢张] 正在创建 Agent: ${id} (${role})...`);
    // 实际调用 API
  }
}

function assignTask() {
  const agentId = prompt('目标 Agent ID:');
  const title = prompt('任务标题:');
  const desc = prompt('任务描述:');
  if (agentId && title) {
    alert(`[福瑞] 任务已分配给 ${agentId}，交给我吧！`);
    // 实际调用 API
  }
}

function broadcastMessage() {
  const subject = prompt('广播主题:');
  const content = prompt('广播内容:');
  if (subject && content) {
    alert(`[福瑞] 广播已发送！所有 Agent 都会收到。`);
    // 实际调用 API
  }
}

function exportData() {
  const data = {
    agents: document.getElementById('hub-agents').textContent,
    messages: document.getElementById('hub-messages').textContent,
    timestamp: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pheromone-export-${Date.now()}.json`;
  a.click();
  alert('数据已导出！');
}

// ============================================================================
// Utilities
// ============================================================================

function getRoleColor(role) {
  const colors = {
    manager: '#ff6b6b',
    developer: '#00d9ff',
    reviewer: '#00ff88',
    tester: '#ffa502'
  };
  return colors[role] || '#888';
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function formatTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateLastUpdate() {
  const now = new Date();
  document.getElementById('last-update').textContent = `最后更新：${now.toLocaleTimeString('zh-CN')}`;
}
