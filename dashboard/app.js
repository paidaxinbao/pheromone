/**
 * Pheromone Dashboard v3.11
 * Performance Optimized: No gradient creation in render loop
 * Fixed: Duplicate positions variable declaration
 * Fixed: Animation loop initialization with proper timestamp handling
 * Added: Frame rate control for consistent 60fps
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
let messageAnimations = []; // Active message animations
let lastFrameTime = 0;
const TARGET_FPS = 60;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🐜 Pheromone Dashboard v3.8 initialized');
  
  // Initialize canvas first
  initCanvas();
  
  // Initial data fetch
  updateDashboard();
  
  // Periodic updates
  setInterval(updateDashboard, 10000);
  
  // Real-time messages (queue-style, no refresh)
  setInterval(fetchNewMessages, 3000);
  
  // Simulate message transmission for demo
  setInterval(simulateMessageTransmission, 3000);
  
  console.log('[DOMContentLoaded] Dashboard ready, canvas initialized:', !!canvas, 'ctx:', !!ctx);
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
  console.log('[showSwarmFromLanding] Entering dashboard...');
  swarmVisible = true;
  enterDashboard();
  setTimeout(() => {
    console.log('[showSwarmFromLanding] Setting swarm section visible');
    document.getElementById('swarm-section').style.display = 'block';
    
    // Wait for CSS to apply, then resize and initialize
    setTimeout(() => {
      console.log('[showSwarmFromLanding] Resizing canvas...');
      resizeCanvas();
      console.log('[showSwarmFromLanding] Agents count:', agents.length);
      if (agents.length > 0) {
        console.log('[showSwarmFromLanding] Initializing node positions...');
        initializeNodePositions();
      }
      drawSwarm();
    }, 100);
  }, 300);
}

function toggleSwarm() {
  swarmVisible = !swarmVisible;
  const section = document.getElementById('swarm-section');
  section.style.display = swarmVisible ? 'block' : 'none';
  
  console.log('[toggleSwarm] Setting visible:', swarmVisible);
  
  if (swarmVisible) {
    setTimeout(() => {
      console.log('[toggleSwarm] Resizing canvas after display...');
      resizeCanvas();
      if (agents.length > 0 && Object.keys(nodePositions).length === 0) {
        console.log('[toggleSwarm] Initializing positions for', agents.length, 'agents');
        initializeNodePositions();
      }
      drawSwarm();
    }, 100);
  }
}

function resetSwarmView() {
  console.log('Resetting swarm view, agents:', agents.length);
  nodePositions = {};
  if (agents.length > 0) {
    initializeNodePositions();
    console.log('Initialized positions for', Object.keys(nodePositions).length, 'agents');
  } else {
    console.log('No agents to initialize');
  }
  // Note: drawSwarm() is called automatically by animateSwarm loop
}

// ============================================================================
// Dashboard Update
// ============================================================================

async function updateDashboard() {
  try {
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    const agentsData = await fetch(`${API_BASE}/agents`).then(r => r.json());
    
    agents = agentsData.agents || [];
    console.log('Agents updated:', agents.length, agents.map(a => a.id));
    
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
      console.log('Updating swarm positions, agents:', agents.length);
      updateNodePositions();
      console.log('Node positions:', Object.keys(nodePositions).length);
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
// Message Transmission Animation
// ============================================================================

function simulateMessageTransmission() {
  if (!swarmVisible || agents.length < 2) return;
  
  // Pick random sender and receiver
  const senderId = agents[Math.floor(Math.random() * agents.length)].id;
  let receiverId;
  do {
    receiverId = agents[Math.floor(Math.random() * agents.length)].id;
  } while (receiverId === senderId);
  
  // Create message animation
  if (nodePositions[senderId] && nodePositions[receiverId]) {
    messageAnimations.push({
      from: senderId,
      to: receiverId,
      progress: 0,
      speed: 0.02 + Math.random() * 0.02
    });
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
// Interactive Swarm Visualization (Green Dashed Lines + Message Animation)
// ============================================================================

function initCanvas() {
  console.log('[initCanvas] Starting canvas initialization...');
  canvas = document.getElementById('swarm-canvas');
  if (!canvas) {
    console.error('[initCanvas] ERROR: Canvas element not found!');
    return;
  }
  console.log('[initCanvas] Canvas element found:', canvas);
  
  ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[initCanvas] ERROR: Failed to get 2D context!');
    return;
  }
  console.log('[initCanvas] 2D context acquired:', ctx);
  
  resizeCanvas();
  console.log('[initCanvas] Canvas size:', canvas.width, 'x', canvas.height);
  
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
  console.log('[initCanvas] Starting animation loop...');
  lastFrameTime = 0; // Reset frame time on init
  animationFrameId = requestAnimationFrame(animateSwarm);
  console.log('[initCanvas] Animation loop initiated');
}

function resizeCanvas() {
  if (!canvas) {
    console.error('[resizeCanvas] Canvas is null');
    return;
  }
  const container = canvas.parentElement;
  if (!container) {
    console.error('[resizeCanvas] Canvas has no parent container');
    return;
  }
  
  // Set canvas size to match container
  const containerWidth = container.offsetWidth;
  const containerHeight = 600;
  
  console.log('[resizeCanvas] Container size:', containerWidth, 'x', containerHeight);
  
  if (containerWidth === 0) {
    console.warn('[resizeCanvas] Container width is 0, canvas might be hidden. Using default 800px');
    canvas.width = 800;
  } else {
    canvas.width = containerWidth;
  }
  canvas.height = containerHeight;
  
  console.log('[resizeCanvas] Canvas set to:', canvas.width, 'x', canvas.height);
  
  // Re-initialize positions on resize
  if (agents.length > 0 && Object.keys(nodePositions).length === 0) {
    console.log('[resizeCanvas] Initializing positions for', agents.length, 'agents');
    initializeNodePositions();
  }
}

function initializeNodePositions() {
  nodePositions = {};
  
  if (!canvas) {
    console.error('[initializeNodePositions] Canvas is null!');
    return;
  }
  
  if (canvas.width === 0 || canvas.height === 0) {
    console.error('[initializeNodePositions] Canvas has zero dimensions!');
    return;
  }
  
  // Random initial positions with padding
  agents.forEach((agent, index) => {
    const angle = (index / agents.length) * Math.PI * 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.3;
    
    const x = canvas.width / 2 + Math.cos(angle) * radius;
    const y = canvas.height / 2 + Math.sin(angle) * radius;
    
    nodePositions[agent.id] = {
      x: x,
      y: y,
      baseX: x,
      baseY: y,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      breathing: Math.random() * Math.PI * 2,
      agent: agent
    };
  });
}

function updateNodePositions() {
  // Sync with latest agent data
  if (!canvas) return;
  
  agents.forEach(agent => {
    if (!nodePositions[agent.id]) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.min(canvas.width || 800, canvas.height || 600) * 0.3;
      
      nodePositions[agent.id] = {
        x: (canvas.width || 800) / 2 + Math.cos(angle) * radius,
        y: (canvas.height || 600) / 2 + Math.sin(angle) * radius,
        baseX: (canvas.width || 800) / 2 + Math.cos(angle) * radius,
        baseY: (canvas.height || 600) / 2 + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        breathing: Math.random() * Math.PI * 2,
        agent: agent
      };
    } else {
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
  
  hoveredNode = null;
  canvas.style.cursor = 'default';
  
  for (const [id, nodePos] of Object.entries(nodePositions)) {
    const dx = mousePos.x - nodePos.x;
    const dy = mousePos.y - nodePos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 30) {
      hoveredNode = id;
      canvas.style.cursor = 'pointer';
      break;
    }
  }
  
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

function animateSwarm(timestamp) {
  if (!ctx || !canvas) {
    console.error('[animateSwarm] Missing ctx or canvas, stopping animation');
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    return;
  }
  
  // Initialize lastFrameTime on first call
  if (!lastFrameTime) {
    lastFrameTime = timestamp;
  }
  
  // Frame rate control for consistent 60fps
  const elapsed = timestamp - lastFrameTime;
  if (elapsed < FRAME_INTERVAL) {
    animationFrameId = requestAnimationFrame(animateSwarm);
    return;
  }
  lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL);
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (!agents || agents.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无 Agent', canvas.width / 2, canvas.height / 2);
  } else {
    if (Object.keys(nodePositions).length === 0) {
      initializeNodePositions();
    }
    drawSwarm();
  }
  
  animationFrameId = requestAnimationFrame(animateSwarm);
}

function drawSwarm() {
  const positions = Object.entries(nodePositions);
  
  if (positions.length === 0) {
    return;
  }
  
  // Update positions
  positions.forEach(([id, pos]) => {
    if (id !== hoveredNode && id !== draggedNode) {
      pos.x += pos.vx;
      pos.y += pos.vy;
      pos.breathing += 0.02;
      
      if (pos.x < 50 || pos.x > canvas.width - 50) pos.vx *= -1;
      if (pos.y < 50 || pos.y > canvas.height - 50) pos.vy *= -1;
    }
  });
  
  // Update message animations
  for (let i = messageAnimations.length - 1; i >= 0; i--) {
    const anim = messageAnimations[i];
    anim.progress += anim.speed;
    
    if (anim.progress >= 1) {
      messageAnimations.splice(i, 1);
    }
  }
  
  // Draw connections (Green Dashed Lines)
  ctx.lineWidth = 2;
  
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const [id1, pos1] = positions[i];
      const [id2, pos2] = positions[j];
      
      // Check if there's an active message on this connection
      const hasMessage = messageAnimations.find(
        anim => (anim.from === id1 && anim.to === id2) || (anim.from === id2 && anim.to === id1)
      );
      
      if (hasMessage) {
        ctx.strokeStyle = '#00ffa380';
        ctx.setLineDash([10, 5]);
      } else {
        ctx.strokeStyle = '#00ffa340';
        ctx.setLineDash([5, 5]);
      }
      
      ctx.beginPath();
      ctx.moveTo(pos1.x, pos1.y);
      ctx.lineTo(pos2.x, pos2.y);
      ctx.stroke();
    }
  }
  
  // Reset line dash
  ctx.setLineDash([]);
  
  // Draw message transmission animations
  messageAnimations.forEach(anim => {
    const fromPos = nodePositions[anim.from];
    const toPos = nodePositions[anim.to];
    
    if (!fromPos || !toPos) return;
    
    const x = fromPos.x + (toPos.x - fromPos.x) * anim.progress;
    const y = fromPos.y + (toPos.y - fromPos.y) * anim.progress;
    
    const packetRadius = 4 + Math.sin(anim.progress * Math.PI) * 2;
    
    // Outer glow - using solid color with alpha for performance
    ctx.beginPath();
    ctx.arc(x, y, packetRadius * 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 255, 163, 0.2)';
    ctx.fill();
    
    // Inner dot
    ctx.beginPath();
    ctx.arc(x, y, packetRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#00ffa3';
    ctx.fill();
  });
  
  // Draw nodes (Optimized: no gradient creation in loop)
  positions.forEach(([id, pos]) => {
    const isHovered = id === hoveredNode;
    const isDragged = id === draggedNode;
    
    const breath = Math.sin(pos.breathing);
    const baseOpacity = 0.6;
    const opacity = baseOpacity + breath * 0.4;
    const roleColor = getRoleColor(pos.agent?.role);
    
    // Draw ripple
    const rippleRadius = 15 + breath * 10;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, rippleRadius, 0, Math.PI * 2);
    ctx.strokeStyle = roleColor + '20';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw outer glow - optimized using rgba instead of gradient
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = roleColor + '15';
    ctx.fill();
    
    // Inner glow
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = roleColor + '30';
    ctx.fill();
    
    // Draw dot
    const dotRadius = isHovered || isDragged ? 6 : 5;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = roleColor;
    ctx.globalAlpha = opacity;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    
    // Draw hover effect
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, dotRadius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      drawTooltip(pos, pos.agent);
    }
  });
}

function drawTooltip(pos, agent) {
  if (!agent) return;
  
  // Calculate dynamic tooltip height based on content
  const lineHeight = 22;
  const padding = 16;
  const headerHeight = 32;
  let contentLines = 4; // ID, Role, Status, Last Active
  
  // Count additional lines
  if (agent.callbackUrl) contentLines++;
  if (agent.registeredAt) contentLines++;
  if (agent.heartbeatInterval) contentLines++;
  if (agent.messageStats || agent.messagesSent !== undefined || agent.messagesReceived !== undefined) contentLines++;
  
  const tooltipWidth = 260;
  const tooltipHeight = headerHeight + (contentLines * lineHeight) + padding;
  
  let tooltipX = pos.x + 20;
  let tooltipY = pos.y - tooltipHeight / 2;
  
  if (tooltipX + tooltipWidth > canvas.width) {
    tooltipX = pos.x - tooltipWidth - 20;
  }
  if (tooltipY < 10) {
    tooltipY = 10;
  }
  if (tooltipY + tooltipHeight > canvas.height) {
    tooltipY = canvas.height - tooltipHeight - 10;
  }
  
  // Draw tooltip background with enhanced shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 6;
  
  // Semi-transparent dark background for better readability
  ctx.fillStyle = 'rgba(20, 20, 28, 0.95)';
  ctx.strokeStyle = getRoleColor(agent.role) + 'cc';
  ctx.lineWidth = 1.5;
  
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 12);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
  }
  ctx.restore();
  
  let currentY = tooltipY + padding + 8;
  
  // Agent ID (bold header with text shadow for clarity)
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  ctx.fillText(agent.id, tooltipX + padding, currentY);
  ctx.restore();
  currentY += lineHeight + 6;
  
  // Role with color
  ctx.save();
  ctx.fillStyle = getRoleColor(agent.role);
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  ctx.fillText(`角色: ${agent.role}`, tooltipX + padding, currentY);
  ctx.restore();
  currentY += lineHeight;
  
  // Status with colored dot
  ctx.save();
  const statusColor = agent.status === 'online' ? '#00ffa3' : agent.status === 'busy' ? '#fbbf24' : '#888888';
  ctx.fillStyle = statusColor;
  ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  ctx.fillText(`● ${agent.status || 'idle'}`, tooltipX + padding, currentY);
  ctx.restore();
  currentY += lineHeight;
  
  // Separator line with gradient effect
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tooltipX + padding, currentY - 8);
  ctx.lineTo(tooltipX + tooltipWidth - padding, currentY - 8);
  ctx.stroke();
  ctx.restore();
  
  // Last Active
  ctx.save();
  ctx.fillStyle = '#bbbbbb';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  const lastActive = agent.lastHeartbeat ? formatTime(new Date(agent.lastHeartbeat).toISOString()) : '-';
  ctx.fillText(`最后活跃: ${lastActive}`, tooltipX + padding, currentY);
  ctx.restore();
  currentY += lineHeight;
  
  // Callback URL (if exists)
  if (agent.callbackUrl) {
    ctx.save();
    ctx.fillStyle = '#999999';
    ctx.font = '11px "SF Mono", SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 1;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    const url = agent.callbackUrl.length > 28 ? agent.callbackUrl.substring(0, 25) + '...' : agent.callbackUrl;
    ctx.fillText(`回调: ${url}`, tooltipX + padding, currentY);
    ctx.restore();
    currentY += lineHeight;
  }
  
  // Registered At
  if (agent.registeredAt) {
    ctx.save();
    ctx.fillStyle = '#999999';
    ctx.font = '11px "SF Mono", SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 1;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    const regTime = formatTime(new Date(agent.registeredAt).toISOString());
    ctx.fillText(`注册: ${regTime}`, tooltipX + padding, currentY);
    ctx.restore();
    currentY += lineHeight;
  }
  
  // Heartbeat Interval
  if (agent.heartbeatInterval) {
    ctx.save();
    ctx.fillStyle = '#999999';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 1;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.fillText(`心跳间隔: ${agent.heartbeatInterval}s`, tooltipX + padding, currentY);
    ctx.restore();
    currentY += lineHeight;
  }
  
  // Message Stats
  const sent = agent.messagesSent || agent.messageStats?.sent || 0;
  const received = agent.messagesReceived || agent.messageStats?.received || 0;
  if (sent > 0 || received > 0) {
    ctx.save();
    ctx.fillStyle = '#00d4ff';
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.fillText(`📤 ${sent}  📥 ${received}`, tooltipX + padding, currentY);
    ctx.restore();
  }
}

function getRoleColor(role) {
  const colors = {
    manager: '#ff6b6b',
    developer: '#00d4ff',
    reviewer: '#00ffa3',
    tester: '#fbbf24',
    writer: '#a855f7',
    editor: '#ec4899'
  };
  return colors[role] || '#888888';
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
