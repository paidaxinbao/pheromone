/**
 * Pheromone Dashboard v3.4
 * HeroUI Inspired + Interactive Swarm + Breathing Effect + Ripple Animation
 */

const API_BASE = 'http://localhost:18888';
let agents = [];
let messages = [];
let swarmVisible = false;
let canvas, ctx;
let currentModalAction = null;
let draggedNode = null;
let nodePositions = {};

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🐜 Pheromone Dashboard v3.4 initialized');
  
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

function resetSwarmView() {
  nodePositions = {};
  drawSwarm();
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
// Interactive Swarm Visualization
// ============================================================================

function initCanvas() {
  canvas = document.getElementById('swarm-canvas');
  if (!canvas) return;
  
  ctx = canvas.getContext('2d');
  resizeCanvas();
  
  // Mouse events for dragging
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseout', handleMouseUp);
  
  // Touch events for mobile
  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMove);
  canvas.addEventListener('touchend', handleMouseUp);
  
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  if (!canvas) return;
  const container = canvas.parentElement;
  canvas.width = container.offsetWidth;
  canvas.height = 600;
  
  // Re-initialize positions on resize
  if (agents.length > 0 && Object.keys(nodePositions).length === 0) {
    initializeNodePositions();
  }
}

function initializeNodePositions() {
  nodePositions = {};
  
  // Random initial positions
  agents.forEach(agent => {
    const padding = 100;
    nodePositions[agent.id] = {
      x: padding + Math.random() * (canvas.width - padding * 2),
      y: padding + Math.random() * (canvas.height - padding * 2),
      role: agent.role,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      breathing: Math.random() * Math.PI * 2
    };
  });
}

function handleMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Check if clicking on a node
  for (const [id, pos] of Object.entries(nodePositions)) {
    const dx = x - pos.x;
    const dy = y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 20) {
      draggedNode = id;
      canvas.style.cursor = 'grabbing';
      
      // Show agent details
      showAgentDetails(id);
      break;
    }
  }
}

function handleMouseMove(e) {
  if (!draggedNode) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Update node position
  nodePositions[draggedNode].x = x;
  nodePositions[draggedNode].y = y;
  
  drawSwarm();
}

function handleMouseUp() {
  draggedNode = null;
  if (canvas) {
    canvas.style.cursor = 'grab';
  }
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  handleMouseDown(mouseEvent);
}

function handleTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  handleMouseMove(mouseEvent);
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
  
  // Initialize positions if needed
  if (Object.keys(nodePositions).length === 0) {
    initializeNodePositions();
  }
  
  // Update positions
  Object.values(nodePositions).forEach(pos => {
    if (pos !== draggedNode) {
      pos.x += pos.vx;
      pos.y += pos.vy;
      pos.breathing += 0.05;
      
      // Boundary check with bounce
      if (pos.x < 50 || pos.x > canvas.width - 50) pos.vx *= -1;
      if (pos.y < 50 || pos.y > canvas.height - 50) pos.vy *= -1;
    }
  });
  
  // Draw connections (workflow-style, thicker lines)
  ctx.lineWidth = 3;
  const positions = Object.entries(nodePositions);
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const [id1, pos1] = positions[i];
      const [id2, pos2] = positions[j];
      
      const gradient = ctx.createLinearGradient(pos1.x, pos1.y, pos2.x, pos2.y);
      gradient.addColorStop(0, getRoleColor(pos1.role) + '60');
      gradient.addColorStop(1, getRoleColor(pos2.role) + '20');
      
      ctx.beginPath();
      ctx.moveTo(pos1.x, pos1.y);
      ctx.lineTo(pos2.x, pos2.y);
      ctx.strokeStyle = gradient;
      ctx.stroke();
    }
  }
  
  // Draw nodes
  positions.forEach(([id, pos]) => {
    // Breathing effect
    const breath = Math.sin(pos.breathing) * 3;
    const baseRadius = 15;
    const radius = baseRadius + breath;
    
    // Draw ripple if agent is working (breathing strongly)
    if (Math.abs(breath) > 2) {
      const rippleRadius = radius + 10 + Math.sin(pos.breathing * 2) * 5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, rippleRadius, 0, Math.PI * 2);
      ctx.strokeStyle = getRoleColor(pos.role) + '40';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Draw outer glow
    const gradient = ctx.createRadialGradient(pos.x, pos.y, radius * 0.5, pos.x, pos.y, radius * 2);
    gradient.addColorStop(0, getRoleColor(pos.role) + '80');
    gradient.addColorStop(1, getRoleColor(pos.role) + '00');
    
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius * 2, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw node
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = getRoleColor(pos.role);
    ctx.fill();
    
    // Draw highlight
    ctx.beginPath();
    ctx.arc(pos.x - radius * 0.3, pos.y - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
  });
  
  requestAnimationFrame(drawSwarm);
}

function getRoleColor(role) {
  const colors = {
    manager: '#ff6b6b',
    developer: '#00d4ff',
    reviewer: '#00ffa3',
    tester: '#fbbf24'
  };
  return colors[role] || '#888';
}

// ============================================================================
// Agent Details Modal
// ============================================================================

function showAgentDetails(agentId) {
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return;
  
  const modal = document.getElementById('agent-modal');
  const title = document.getElementById('agent-modal-title');
  const body = document.getElementById('agent-modal-body');
  
  title.textContent = agentId;
  body.innerHTML = `
    <div class="agent-detail">
      <div class="agent-detail-icon" style="background: ${getRoleColor(agent.role)};"></div>
      <div class="agent-detail-id">${agent.id}</div>
      <div class="agent-detail-role">${agent.role}</div>
      
      <div class="agent-detail-stats">
        <div class="agent-detail-stat">
          <div class="stat-value-large">${agent.status || 'idle'}</div>
          <div class="stat-label-small">状态</div>
        </div>
        <div class="agent-detail-stat">
          <div class="stat-value-large">${formatTime(agent.lastHeartbeat)}</div>
          <div class="stat-label-small">最后活跃</div>
        </div>
      </div>
      
      ${agent.callbackUrl ? `
        <div style="margin-top: 20px; padding: 15px; background: var(--bg-card-hover); border-radius: 8px;">
          <div style="color: var(--text-muted); font-size: 0.8em; margin-bottom: 5px;">Callback URL</div>
          <div style="font-family: 'SF Mono', monospace; font-size: 0.85em; word-break: break-all;">${agent.callbackUrl}</div>
        </div>
      ` : ''}
    </div>
  `;
  
  modal.classList.add('active');
}

function closeAgentModal() {
  document.getElementById('agent-modal').classList.remove('active');
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
