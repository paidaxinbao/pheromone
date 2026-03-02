/**
 * Pheromone Dashboard v3.0
 * 蜂群可视化 + 双模式切换 + 队列式消息
 * Created by Fancy (幻彩) - Frontend Expert Agent
 */

const API_BASE = 'http://localhost:18888';
const UPDATE_INTERVAL = 10000; // 10 seconds

// State
let currentMode = 'simple'; // 'simple' or 'complex'
let showVisualization = false;
let agents = [];
let messages = [];
let lastMessageId = null;

// Canvas Visualization
let canvas, ctx;
let animationFrame;
let nodes = [];
let connections = [];

// Charts
let agentRoleChart = null;
let messageTypeChart = null;
let activityTrendChart = null;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🐜 Pheromone Dashboard v3.0 initialized by Fancy');
  
  // Initialize charts (complex mode)
  initCharts();
  
  // Initialize canvas (visualization)
  initCanvas();
  
  // Initial update
  updateDashboard();
  
  // Periodic updates
  setInterval(updateDashboard, UPDATE_INTERVAL);
  
  // Real-time message updates (queue-style, no refresh)
  setInterval(fetchNewMessages, 3000);
  
  // Animation loop
  animate();
});

// ============================================================================
// Mode Toggle
// ============================================================================

function toggleMode() {
  currentMode = currentMode === 'simple' ? 'complex' : 'simple';
  
  const simpleMode = document.getElementById('simple-mode');
  const complexMode = document.getElementById('complex-mode');
  const modeBtn = document.getElementById('mode-toggle');
  
  if (currentMode === 'simple') {
    simpleMode.style.display = 'block';
    complexMode.style.display = 'none';
    modeBtn.querySelector('.mode-text').textContent = '简约模式';
    modeBtn.querySelector('.mode-icon').textContent = '🔍';
  } else {
    simpleMode.style.display = 'none';
    complexMode.style.display = 'block';
    modeBtn.querySelector('.mode-text').textContent = '复杂模式';
    modeBtn.querySelector('.mode-icon').textContent = '📊';
    updateCharts();
  }
  
  console.log(`[Fancy] Switched to ${currentMode} mode`);
}

function toggleVisualization() {
  showVisualization = !showVisualization;
  const vizBtn = document.getElementById('visual-toggle');
  
  if (showVisualization) {
    // Switch to complex mode if in simple mode
    if (currentMode === 'simple') {
      toggleMode();
    }
    vizBtn.querySelector('.visual-text').textContent = '隐藏蜂群';
    vizBtn.querySelector('.visual-icon').textContent = '🕸️';
    resizeCanvas();
  } else {
    vizBtn.querySelector('.visual-text').textContent = '显示蜂群';
    vizBtn.querySelector('.visual-icon').textContent = '👁️';
  }
}

// ============================================================================
// Canvas Visualization (Swarm)
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
  canvas.height = container.offsetHeight;
}

function updateNodes() {
  // Create nodes from agents
  nodes = agents.map((agent, index) => {
    const angle = (index / agents.length) * Math.PI * 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.35;
    return {
      id: agent.id,
      role: agent.role,
      x: canvas.width / 2 + Math.cos(angle) * radius,
      y: canvas.height / 2 + Math.sin(angle) * radius,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      pulse: Math.random() * Math.PI * 2
    };
  });
}

function drawNodes() {
  nodes.forEach(node => {
    // Pulse animation
    node.pulse += 0.05;
    const pulseRadius = 25 + Math.sin(node.pulse) * 5;
    
    // Draw pulse ring
    ctx.beginPath();
    ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = getRoleColor(node.role);
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw node
    ctx.beginPath();
    ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = getRoleColor(node.role);
    ctx.fill();
    
    // Draw label
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(node.id, node.x, node.y + 35);
    
    // Gentle movement
    node.x += node.vx;
    node.y += node.vy;
    
    // Boundary check
    const margin = 50;
    if (node.x < margin || node.x > canvas.width - margin) node.vx *= -1;
    if (node.y < margin || node.y > canvas.height - margin) node.vy *= -1;
  });
}

function drawConnections() {
  // Draw connections between all nodes (represents potential communication)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const from = nodes[i];
      const to = nodes[j];
      
      const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      gradient.addColorStop(0, `${getRoleColor(from.role)}80`);
      gradient.addColorStop(1, `${getRoleColor(to.role)}20`);
      
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function animate() {
  if (!showVisualization || !ctx) {
    animationFrame = requestAnimationFrame(animate);
    return;
  }
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  drawConnections();
  drawNodes();
  
  animationFrame = requestAnimationFrame(animate);
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

function resetView() {
  updateNodes();
}

function toggleConnections() {
  // Toggle connection visibility (can be enhanced)
  console.log('Toggle connections');
}

// ============================================================================
// Dashboard Update
// ============================================================================

async function updateDashboard() {
  try {
    await Promise.all([
      updateHubStatus(),
      updateAgents(),
      fetchMessages()
    ]);
    
    if (currentMode === 'complex') {
      await updateCharts();
    }
    
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
  
  // Simple mode
  document.getElementById('simple-hub-status').textContent = '在线';
  document.getElementById('simple-hub-status').className = 'stat-value status-online';
  document.getElementById('simple-agents').textContent = health.agents;
  document.getElementById('simple-messages').textContent = health.messages;
  
  // Complex mode
  document.getElementById('hub-status').textContent = '在线';
  document.getElementById('hub-status').className = 'value status-online';
  document.getElementById('hub-uptime').textContent = formatUptime(health.uptime);
  document.getElementById('hub-agents').textContent = health.agents;
  document.getElementById('hub-messages').textContent = health.messages;
}

async function updateAgents() {
  const data = await fetch(`${API_BASE}/agents`).then(r => r.json());
  agents = data.agents || [];
  
  renderSimpleAgents(agents);
  renderAgents(agents);
  updateNodes(); // Update visualization
}

async function fetchMessages() {
  const data = await fetch(`${API_BASE}/messages/history?limit=50`).then(r => r.json());
  messages = data.messages || [];
  
  renderSimpleMessages(messages.slice(0, 10));
}

async function fetchNewMessages() {
  const data = await fetch(`${API_BASE}/messages/history?limit=10`).then(r => r.json());
  const newMessages = data.messages || [];
  
  // Queue-style: add new messages one by one
  newMessages.forEach((msg, index) => {
    setTimeout(() => {
      addMessageToQueue(msg);
    }, index * 200); // Staggered animation
  });
}

function addMessageToQueue(msg) {
  const log = document.getElementById('message-log');
  if (!log) return;
  
  // Check if message already exists
  if (document.getElementById(`msg-${msg.id}`)) return;
  
  const item = document.createElement('div');
  item.className = 'message-item';
  item.id = `msg-${msg.id}`;
  item.innerHTML = renderMessage(msg);
  
  log.insertBefore(item, log.firstChild);
  
  // Keep only 50 messages
  if (log.children.length > 50) {
    log.removeChild(log.lastChild);
  }
}

// ============================================================================
// Rendering
// ============================================================================

function renderSimpleAgents(agents) {
  const list = document.getElementById('simple-agents-list');
  if (!list) return;
  
  if (!agents || agents.length === 0) {
    list.innerHTML = '<p class="empty">暂无 Agent</p>';
    return;
  }
  
  list.innerHTML = agents.map(agent => `
    <div class="simple-agent-item">
      <span>${agent.id}</span>
      <span class="stat-value" style="font-size: 0.8em;">${agent.role}</span>
    </div>
  `).join('');
}

function renderAgents(agents) {
  const grid = document.getElementById('agent-grid');
  if (!grid) return;
  
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
          <span class="value">${formatLocalTime(agent.registeredAt)}</span>
        </div>
        <div class="info-row">
          <span class="label">最后心跳</span>
          <span class="value">${formatLocalTime(new Date(agent.lastHeartbeat).toISOString())}</span>
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

function renderSimpleMessages(messages) {
  const list = document.getElementById('simple-messages-list');
  if (!list) return;
  
  if (!messages || messages.length === 0) {
    list.innerHTML = '<p class="empty">暂无消息</p>';
    return;
  }
  
  list.innerHTML = messages.map(msg => `
    <div class="simple-message-item">
      <div style="font-weight: 600; margin-bottom: 5px;">
        ${msg.sender?.id || 'unknown'} 
        ${msg.recipient?.id ? `→ ${msg.recipient.id}` : '→ 📢'}
      </div>
      <div style="font-size: 0.85em; color: #888;">
        ${msg.payload?.subject || msg.payload?.title || '无主题'}
      </div>
    </div>
  `).join('');
}

function renderMessage(msg) {
  const typeLabel = msg.type.replace('.', ' ');
  const time = formatLocalTime(msg.timestamp);
  const content = msg.payload?.content || msg.payload?.title || JSON.stringify(msg.payload);
  
  return `
    <div class="message-header">
      <span class="message-type">${typeLabel}</span>
      <span class="message-time">${time}</span>
    </div>
    <div class="message-body">
      <strong>${escapeHtml(msg.sender?.id || 'unknown')}</strong> 
      ${msg.recipient?.id ? `→ <strong>${escapeHtml(msg.recipient.id)}</strong>` : '→ 📢 广播'}
      <br>
      ${msg.payload?.subject ? `<em>${escapeHtml(msg.payload.subject)}</em><br>` : ''}
      ${escapeHtml(content)}
    </div>
    <div class="message-sender">
      ID: ${escapeHtml(msg.id)} | 优先级：${escapeHtml(msg.metadata?.priority || 'normal')}
    </div>
  `;
}

// ============================================================================
// Charts (Complex Mode)
// ============================================================================

function initCharts() {
  // Agent Role Chart
  const roleCtx = document.getElementById('agent-role-chart')?.getContext('2d');
  if (roleCtx) {
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
  }
  
  // Message Type Chart
  const typeCtx = document.getElementById('message-type-chart')?.getContext('2d');
  if (typeCtx) {
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
  }
  
  // Activity Trend Chart
  const trendCtx = document.getElementById('activity-trend-chart')?.getContext('2d');
  if (trendCtx) {
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
}

async function updateCharts() {
  if (!agentRoleChart || !messageTypeChart) return;
  
  // Update Agent Role Chart
  const roleCount = { manager: 0, developer: 0, reviewer: 0, tester: 0 };
  agents.forEach(agent => {
    if (roleCount[agent.role] !== undefined) {
      roleCount[agent.role]++;
    }
  });
  agentRoleChart.data.datasets[0].data = Object.values(roleCount);
  agentRoleChart.update();
  
  // Update Message Type Chart
  const typeCount = { direct: 0, broadcast: 0, task: 0, update: 0 };
  messages.forEach(msg => {
    if (msg.type.includes('direct')) typeCount.direct++;
    else if (msg.type.includes('broadcast')) typeCount.broadcast++;
    else if (msg.type.includes('assign')) typeCount.task++;
    else if (msg.type.includes('update')) typeCount.update++;
  });
  messageTypeChart.data.datasets[0].data = Object.values(typeCount);
  messageTypeChart.update();
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
// Modal (HeroUI Style)
// ============================================================================

function openModal(title, content, onConfirm) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = content;
  document.getElementById('modal-overlay').classList.add('active');
  
  window.currentModalConfirm = onConfirm;
}

function closeModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('modal-overlay').classList.remove('active');
  window.currentModalConfirm = null;
}

function confirmModal() {
  if (window.currentModalConfirm) {
    window.currentModalConfirm();
  }
  closeModal();
}

// ============================================================================
// Quick Actions (Enhanced Modals)
// ============================================================================

function createAgent() {
  const content = `
    <div style="display: grid; gap: 15px;">
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">Agent ID</label>
        <input type="text" id="new-agent-id" placeholder="例如：dev-team-1" 
               style="width: 100%; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #e4e4e4;">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">角色</label>
        <select id="new-agent-role" 
                style="width: 100%; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #e4e4e4;">
          <option value="developer">Developer</option>
          <option value="reviewer">Reviewer</option>
          <option value="tester">Tester</option>
          <option value="manager">Manager</option>
        </select>
      </div>
    </div>
  `;
  
  openModal('➕ 创建 Agent', content, () => {
    const id = document.getElementById('new-agent-id').value;
    const role = document.getElementById('new-agent-role').value;
    if (id && role) {
      alert(`[牢张] 正在创建 Agent: ${id} (${role})...`);
      // API call would go here
    }
  });
}

function assignTask() {
  const content = `
    <div style="display: grid; gap: 15px;">
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">目标 Agent</label>
        <input type="text" id="task-agent-id" placeholder="例如：dev-team-1" 
               style="width: 100%; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #e4e4e4;">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">任务标题</label>
        <input type="text" id="task-title" placeholder="例如：实现用户模块" 
               style="width: 100%; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #e4e4e4;">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">任务描述</label>
        <textarea id="task-desc" placeholder="详细描述任务内容..." rows="3"
                  style="width: 100%; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #e4e4e4; resize: vertical;"></textarea>
      </div>
    </div>
  `;
  
  openModal('📋 分配任务', content, () => {
    const agentId = document.getElementById('task-agent-id').value;
    const title = document.getElementById('task-title').value;
    const desc = document.getElementById('task-desc').value;
    if (agentId && title) {
      alert(`[福瑞] 任务已分配给 ${agentId}，交给我吧！`);
      // API call would go here
    }
  });
}

function broadcastMessage() {
  const content = `
    <div style="display: grid; gap: 15px;">
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">广播主题</label>
        <input type="text" id="broadcast-subject" placeholder="例如：项目更新" 
               style="width: 100%; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #e4e4e4;">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">广播内容</label>
        <textarea id="broadcast-content" placeholder="输入广播内容..." rows="4"
                  style="width: 100%; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #e4e4e4; resize: vertical;"></textarea>
      </div>
    </div>
  `;
  
  openModal('📢 广播消息', content, () => {
    const subject = document.getElementById('broadcast-subject').value;
    const content = document.getElementById('broadcast-content').value;
    if (subject && content) {
      alert(`[福瑞] 广播已发送！所有 Agent 都会收到。`);
      // API call would go here
    }
  });
}

function exportData() {
  const data = {
    agents: agents.length,
    messages: messages.length,
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

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function formatLocalTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false
  });
}

function updateLastUpdate() {
  const now = new Date();
  document.getElementById('last-update').textContent = `最后更新：${now.toLocaleTimeString('zh-CN')}`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
