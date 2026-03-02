/**
 * Pheromone Dashboard v3.3
 * Enhanced Landing Page + Cluster Swarm + Slide-in Messages
 */

const API_BASE = 'http://localhost:18888';
let agents = [];
let messages = [];
let swarmVisible = false;
let canvas, ctx;
let currentModalAction = null;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🐜 Pheromone Dashboard v3.3 initialized');
  
  // Initial data fetch
  updateDashboard();
  
  // Periodic updates
  setInterval(updateDashboard, 10000);
  
  // Real-time messages (queue-style, no refresh)
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
  document.getElementById('landing-page').style.display = 'block';
}

function showSwarmFromLanding() {
  swarmVisible = true;
  enterDashboard();
  setTimeout(() => {
    document.getElementById('swarm-section').style.display = 'block';
    resizeCanvas();
    drawSwarm();
  }, 300);
}

function toggleSwarm() {
  swarmVisible = !swarmVisible;
  const section = document.getElementById('swarm-section');
  section.style.display = swarmVisible ? 'block' : 'none';
  
  if (swarmVisible) {
    setTimeout(() => {
      resizeCanvas();
      drawSwarm();
    }, 100);
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
    document.getElementById('landing-agents').textContent = health.agents;
    document.getElementById('landing-messages').textContent = health.messages;
    document.getElementById('landing-uptime').textContent = formatUptime(health.uptime);
    
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
    
    // Update message preview
    if (messages.length > 0) {
      renderMessagePreview(messages.slice(0, 5));
    }
    
    // Update last update time
    document.getElementById('last-update').textContent = `更新于 ${new Date().toLocaleTimeString('zh-CN')}`;
    
    // Redraw swarm if visible
    if (swarmVisible) {
      drawSwarm();
    }
  } catch (error) {
    console.error('Update failed:', error);
  }
}

async function fetchNewMessages() {
  try {
    const data = await fetch(`${API_BASE}/messages/history?limit=20`).then(r => r.json());
    const newMessages = data.messages || [];
    
    // Check for new messages
    if (newMessages.length > messages.length) {
      const addedCount = newMessages.length - messages.length;
      const newOnes = newMessages.slice(0, addedCount);
      
      // Add messages one by one with animation
      newOnes.forEach((msg, index) => {
        setTimeout(() => {
          addMessageToTop(msg);
        }, index * 150);
      });
      
      messages = newMessages;
    }
  } catch (error) {
    console.error('Fetch messages failed:', error);
  }
}

function addMessageToTop(msg) {
  const list = document.getElementById('message-list');
  if (!list) return;
  
  // Remove empty message
  const empty = list.querySelector('.empty');
  if (empty) empty.remove();
  
  const item = document.createElement('div');
  item.className = 'message-item';
  item.id = `msg-${msg.id}`;
  item.innerHTML = renderMessage(msg);
  
  // Insert at top
  list.insertBefore(item, list.firstChild);
  
  // Keep only 50 messages
  if (list.children.length > 50) {
    list.removeChild(list.lastChild);
  }
}

// ============================================================================
// Rendering
// ============================================================================

function renderAgentList(agents) {
  const list = document.getElementById('agent-list');
  if (!list) return;
  
  if (!agents || agents.length === 0) {
    list.innerHTML = '<div class="empty" style="padding: 20px;">暂无 Agent</div>';
    return;
  }
  
  list.innerHTML = agents.map(agent => `
    <div class="agent-item">
      <span>${agent.id}</span>
      <span class="agent-role">${agent.role}</span>
    </div>
  `).join('');
}

function renderMessagePreview(messages) {
  const preview = document.getElementById('message-preview');
  if (!preview) return;
  
  preview.innerHTML = messages.map(msg => `
    <div class="message-item-mini">
      <strong>${escapeHtml(msg.sender?.id || 'unknown')}</strong>
      ${msg.recipient?.id ? `→ ${escapeHtml(msg.recipient.id)}` : '→ 📢'}
      <br>
      <small>${escapeHtml(msg.payload?.subject || msg.payload?.title || '无主题')}</small>
    </div>
  `).join('');
}

function renderMessage(msg) {
  const typeLabel = msg.type.replace('.', ' ');
  const time = formatTime(msg.timestamp);
  const content = msg.payload?.content || msg.payload?.title || JSON.stringify(msg.payload);
  
  return `
    <div class="message-header">
      <span class="message-type">${typeLabel}</span>
      <span class="message-time">${time}</span>
    </div>
    <div class="message-body">
      <strong>${escapeHtml(msg.sender?.id || 'unknown')}</strong>
      ${msg.recipient?.id ? ` → <strong>${escapeHtml(msg.recipient.id)}</strong>` : ' → 📢 广播'}
      ${msg.payload?.subject ? `<br><em>${escapeHtml(msg.payload.subject)}</em>` : ''}
      ${content ? `<br>${escapeHtml(content)}` : ''}
    </div>
    <div class="message-sender">ID: ${escapeHtml(msg.id)} | 优先级：${escapeHtml(msg.metadata?.priority || 'normal')}</div>
  `;
}

// ============================================================================
// Swarm Visualization (Cluster by Role, Workflow-style Lines)
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
  canvas.height = 500;
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
  
  // Group agents by role
  const groups = {
    manager: agents.filter(a => a.role === 'manager'),
    developer: agents.filter(a => a.role === 'developer'),
    reviewer: agents.filter(a => a.role === 'reviewer'),
    tester: agents.filter(a => a.role === 'tester')
  };
  
  // Calculate cluster positions
  const clusterPositions = {
    manager: { x: canvas.width / 2, y: canvas.height * 0.2 },
    developer: { x: canvas.width * 0.25, y: canvas.height * 0.5 },
    reviewer: { x: canvas.width * 0.75, y: canvas.height * 0.5 },
    tester: { x: canvas.width / 2, y: canvas.height * 0.8 }
  };
  
  // Calculate node positions within clusters
  const nodePositions = {};
  Object.keys(groups).forEach(role => {
    const group = groups[role];
    if (group.length === 0) return;
    
    const center = clusterPositions[role];
    const radius = 80;
    
    group.forEach((agent, index) => {
      const angle = (index / group.length) * Math.PI * 2 - Math.PI / 2;
      nodePositions[agent.id] = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
        role: role
      };
    });
  });
  
  // Draw workflow-style connections (thicker lines)
  ctx.lineWidth = 3;
  Object.values(nodePositions).forEach((pos1, i) => {
    Object.values(nodePositions).forEach((pos2, j) => {
      if (i >= j) return;
      
      const gradient = ctx.createLinearGradient(pos1.x, pos1.y, pos2.x, pos2.y);
      gradient.addColorStop(0, getRoleColor(pos1.role) + '60');
      gradient.addColorStop(1, getRoleColor(pos2.role) + '20');
      
      ctx.beginPath();
      ctx.moveTo(pos1.x, pos1.y);
      ctx.lineTo(pos2.x, pos2.y);
      ctx.strokeStyle = gradient;
      ctx.stroke();
    });
  });
  
  // Draw nodes
  Object.entries(nodePositions).forEach(([id, pos]) => {
    const dotSize = 15;
    
    // Draw node
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, dotSize, 0, Math.PI * 2);
    ctx.fillStyle = getRoleColor(pos.role);
    ctx.fill();
    
    // Draw label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(id, pos.x, pos.y + dotSize + 18);
    
    // Draw role
    ctx.fillStyle = getRoleColor(pos.role);
    ctx.font = '10px sans-serif';
    ctx.fillText(pos.role, pos.x, pos.y + dotSize + 32);
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
// Modal Actions
// ============================================================================

function openModal(title, content, onConfirm) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = content;
  document.getElementById('modal-overlay').classList.add('active');
  currentModalAction = onConfirm;
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  currentModalAction = null;
}

function confirmModal() {
  if (currentModalAction) {
    currentModalAction();
  }
  closeModal();
}

function openCreateAgent() {
  const content = `
    <div style="display: grid; gap: 15px;">
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">Agent ID</label>
        <input type="text" id="new-agent-id" placeholder="例如：dev-team-1">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">角色</label>
        <select id="new-agent-role">
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

function openAssignTask() {
  const content = `
    <div style="display: grid; gap: 15px;">
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">目标 Agent</label>
        <input type="text" id="task-agent-id" placeholder="例如：dev-team-1">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">任务标题</label>
        <input type="text" id="task-title" placeholder="例如：实现用户模块">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">任务描述</label>
        <textarea id="task-desc" placeholder="详细描述任务内容..." rows="3"></textarea>
      </div>
    </div>
  `;
  
  openModal('📋 分配任务', content, () => {
    const agentId = document.getElementById('task-agent-id').value;
    const title = document.getElementById('task-title').value;
    const desc = document.getElementById('task-desc').value;
    if (agentId && title) {
      alert(`[福瑞] 任务已分配给 ${agentId}，交给我吧！`);
    }
  });
}

function openBroadcast() {
  const content = `
    <div style="display: grid; gap: 15px;">
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">广播主题</label>
        <input type="text" id="broadcast-subject" placeholder="例如：项目更新">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px; color: #888;">广播内容</label>
        <textarea id="broadcast-content" placeholder="输入广播内容..." rows="4"></textarea>
      </div>
    </div>
  `;
  
  openModal('📢 广播消息', content, () => {
    const subject = document.getElementById('broadcast-subject').value;
    const content = document.getElementById('broadcast-content').value;
    if (subject && content) {
      alert(`[福瑞] 广播已发送！所有 Agent 都会收到。`);
    }
  });
}

// ============================================================================
// Utilities
// ============================================================================

function formatUptime(seconds) {
  if (!seconds) return '0h 0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
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
