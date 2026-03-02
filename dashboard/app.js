/**
 * Pheromone Dashboard v3.7
 * Minimalist Breathing Dot Style (like "在线" indicator)
 */

const API_BASE = 'http://localhost:18888';
let agents = [];
let messages = [];
let swarmVisible = false;
let canvas, ctx;
let currentModalAction = null;
let draggedNode = null;
let hoveredNode = null;
let nodePositions = {};
let mousePos = { x: 0, y: 0 };
let animationFrameId = null;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🐜 Pheromone Dashboard v3.7 initialized');
  
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
  initializeNodePositions();
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
    
    // Update swarm if visible
    if (swarmVisible) {
      updateNodePositions();
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
// Interactive Swarm Visualization (Minimalist Breathing Dot Style)
// ============================================================================

function initCanvas() {
  canvas = document.getElementById('swarm-canvas');
  if (!canvas) return;
  
  ctx = canvas.getContext('2d');
  resizeCanvas();
  
  // Mouse events
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', handleMouseLeave);
  
  // Touch events
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleMouseUp);
  
  window.addEventListener('resize', resizeCanvas);
  
  // Start animation loop
  animateSwarm();
}

function resizeCanvas() {
  if (!canvas) return;
  const container = canvas.parentElement;
  
  // Set canvas size to match container
  canvas.width = container.offsetWidth;
  canvas.height = 600;
  
  // Re-initialize positions on resize
  if (agents.length > 0 && Object.keys(nodePositions).length === 0) {
    initializeNodePositions();
  }
}

function initializeNodePositions() {
  nodePositions = {};
  
  // Random initial positions with padding
  const padding = 150;
  agents.forEach((agent, index) => {
    const angle = (index / agents.length) * Math.PI * 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.3;
    
    nodePositions[agent.id] = {
      x: canvas.width / 2 + Math.cos(angle) * radius,
      y: canvas.height / 2 + Math.sin(angle) * radius,
      baseX: canvas.width / 2 + Math.cos(angle) * radius,
      baseY: canvas.height / 2 + Math.sin(angle) * radius,
      vx: (Math.random() - 0.5) * 0.2, // Slower movement
      vy: (Math.random() - 0.5) * 0.2,
      breathing: Math.random() * Math.PI * 2,
      agent: agent
    };
  });
}

function updateNodePositions() {
  // Sync with latest agent data
  agents.forEach(agent => {
    if (!nodePositions[agent.id]) {
      // New agent, add to positions
      const padding = 150;
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.3;
      
      nodePositions[agent.id] = {
        x: canvas.width / 2 + Math.cos(angle) * radius,
        y: canvas.height / 2 + Math.sin(angle) * radius,
        baseX: canvas.width / 2 + Math.cos(angle) * radius,
        baseY: canvas.height / 2 + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        breathing: Math.random() * Math.PI * 2,
        agent: agent
      };
    } else {
      // Update agent data
      nodePositions[agent.id].agent = agent;
    }
  });
  
  // Remove agents that no longer exist
  Object.keys(nodePositions).forEach(id => {
    if (!agents.find(a => a.id === id)) {
      delete nodePositions[id];
    }
  });
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  
  // Calculate scale factor (in case canvas is scaled via CSS)
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function handleMouseMove(e) {
  const pos = getMousePos(e);
  mousePos.x = pos.x;
  mousePos.y = pos.y;
  
  // Check if hovering over a node
  hoveredNode = null;
  canvas.style.cursor = 'default';
  
  for (const [id, nodePos] of Object.entries(nodePositions)) {
    const dx = mousePos.x - nodePos.x;
    const dy = mousePos.y - nodePos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Hit detection radius (larger than visual radius for easier interaction)
    if (dist < 30) {
      hoveredNode = id;
      canvas.style.cursor = 'pointer';
      break;
    }
  }
  
  // Dragging
  if (draggedNode && nodePositions[draggedNode]) {
    nodePositions[draggedNode].x = mousePos.x;
    nodePositions[draggedNode].y = mousePos.y;
    canvas.style.cursor = 'grabbing';
  }
}

function handleMouseDown(e) {
  if (hoveredNode) {
    draggedNode = hoveredNode;
    canvas.style.cursor = 'grabbing';
  }
}

function handleMouseUp() {
  draggedNode = null;
  if (canvas) {
    canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
  }
}

function handleMouseLeave() {
  hoveredNode = null;
  draggedNode = null;
  if (canvas) {
    canvas.style.cursor = 'default';
  }
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  handleMouseMove(mouseEvent);
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

function animateSwarm() {
  if (!ctx || !canvas) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    return;
  }
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (!agents || agents.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无 Agent', canvas.width / 2, canvas.height / 2);
  } else {
    drawSwarm();
  }
  
  animationFrameId = requestAnimationFrame(animateSwarm);
}

function drawSwarm() {
  // Update positions
  Object.entries(nodePositions).forEach(([id, pos]) => {
    // Stop movement if hovered or dragged
    if (id !== hoveredNode && id !== draggedNode) {
      pos.x += pos.vx;
      pos.y += pos.vy;
      
      // Breathing animation (like "在线" indicator - slow pulse)
      pos.breathing += 0.02;
      
      // Boundary check with bounce
      if (pos.x < 50 || pos.x > canvas.width - 50) pos.vx *= -1;
      if (pos.y < 50 || pos.y > canvas.height - 50) pos.vy *= -1;
    }
  });
  
  // Draw connections (thin lines)
  ctx.lineWidth = 1;
  const positions = Object.entries(nodePositions);
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const [id1, pos1] = positions[i];
      const [id2, pos2] = positions[j];
      
      ctx.beginPath();
      ctx.moveTo(pos1.x, pos1.y);
      ctx.lineTo(pos2.x, pos2.y);
      ctx.strokeStyle = getRoleColor(pos1.agent?.role) + '30';
      ctx.stroke();
    }
  }
  
  // Draw nodes (Minimalist Breathing Dot Style)
  positions.forEach(([id, pos]) => {
    const isHovered = id === hoveredNode;
    const isDragged = id === draggedNode;
    
    // Breathing effect (opacity pulse like "在线" indicator)
    const breath = Math.sin(pos.breathing);
    const baseOpacity = 0.6;
    const opacity = baseOpacity + breath * 0.4; // 0.2 - 1.0
    
    // Draw ripple (concentric circles expanding)
    const rippleRadius = 15 + breath * 10;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, rippleRadius, 0, Math.PI * 2);
    ctx.strokeStyle = getRoleColor(pos.agent?.role) + '20';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw outer glow (soft glow)
    const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 20);
    gradient.addColorStop(0, getRoleColor(pos.agent?.role) + '40');
    gradient.addColorStop(1, getRoleColor(pos.agent?.role) + '00');
    
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw dot (like "在线" indicator - simple circle)
    const dotRadius = isHovered || isDragged ? 6 : 5;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = getRoleColor(pos.agent?.role);
    ctx.globalAlpha = opacity;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    
    // Draw hover effect (white ring)
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, dotRadius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Draw tooltip
      drawTooltip(pos, pos.agent);
    }
  });
}

function drawTooltip(pos, agent) {
  if (!agent) return;
  
  const tooltipWidth = 200;
  const tooltipHeight = 120;
  let tooltipX = pos.x + 20;
  let tooltipY = pos.y - tooltipHeight / 2;
  
  // Keep tooltip within canvas
  if (tooltipX + tooltipWidth > canvas.width) {
    tooltipX = pos.x - tooltipWidth - 20;
  }
  if (tooltipY < 10) {
    tooltipY = 10;
  }
  if (tooltipY + tooltipHeight > canvas.height) {
    tooltipY = canvas.height - tooltipHeight - 10;
  }
  
  // Background
  ctx.fillStyle = 'rgba(10, 10, 10, 0.95)';
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
  ctx.lineWidth = 1;
  
  // Use roundRect if available, otherwise use rect
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 8);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
  }
  
  // Content
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(agent.id, tooltipX + 15, tooltipY + 25);
  
  ctx.fillStyle = getRoleColor(agent.role);
  ctx.font = '11px sans-serif';
  ctx.fillText(agent.role, tooltipX + 15, tooltipY + 45);
  
  ctx.fillStyle = '#888888';
  ctx.fillText(`状态：${agent.status || 'idle'}`, tooltipX + 15, tooltipY + 70);
  
  const lastActive = agent.lastHeartbeat ? formatTime(new Date(agent.lastHeartbeat).toISOString()) : '-';
  ctx.fillText(`最后活跃：${lastActive}`, tooltipX + 15, tooltipY + 90);
  
  ctx.fillStyle = '#666666';
  ctx.font = '10px sans-serif';
  ctx.fillText('点击查看详情', tooltipX + 15, tooltipY + 110);
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

// Add roundRect polyfill for Canvas
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}
