/**
 * Agent State Manager - Agent 状态管理器
 * 
 * 职责:
 * - 跟踪每个 Agent 的实时状态
 * - 管理 Agent 的生命周期
 * - 检测超时和离线
 * 
 * 状态转换:
 * idle → (发送消息) → busy
 * busy → (收到ACK) → idle
 * busy → (5分钟超时) → suspended
 * suspended → (手动恢复) → idle
 * idle → (90秒无心跳) → offline
 * offline → (心跳恢复) → idle
 * 
 * @version 2.0.0
 */

class AgentStateManager {
  constructor(config = {}) {
    this.config = {
      maxConcurrentMessages: config.maxConcurrentMessages || 1,
      busyTimeout: config.busyTimeout || 300000,       // 5分钟
      offlineTimeout: config.offlineTimeout || 90000,  // 90秒
      suspendedAutoRecovery: config.suspendedAutoRecovery || false
    };
    
    // Agent 状态存储
    // Map<agentId, AgentState>
    this.states = new Map();
    
    // 日志
    this.log = {
      info: (msg, ...args) => console.log(`[${new Date().toISOString()}] [StateManager] [INFO] ${msg}`, ...args),
      error: (msg, ...args) => console.error(`[${new Date().toISOString()}] [StateManager] [ERROR] ${msg}`, ...args),
      debug: (msg, ...args) => process.env.DEBUG && console.log(`[${new Date().toISOString()}] [StateManager] [DEBUG] ${msg}`, ...args)
    };
  }

  /**
   * 注册新 Agent
   * @param {string} agentId 
   * @param {object} agentInfo 
   * @returns {object} Agent 状态
   */
  registerAgent(agentId, agentInfo = {}) {
    const now = Date.now();
    
    const state = {
      id: agentId,
      role: agentInfo.role || 'unknown',
      status: 'idle',
      
      lastHeartbeat: now,
      lastActivity: now,
      registeredAt: now,
      suspendedAt: null,
      
      processingMessages: [],
      queueSize: 0,
      processedCount: 0,
      suspendReason: null,
      
      callbackUrl: agentInfo.callbackUrl || null,
      metadata: agentInfo.metadata || {}
    };
    
    this.states.set(agentId, state);
    this.log.info(`Agent registered: ${agentId} (role: ${state.role})`);
    
    return state;
  }

  /**
   * 更新心跳
   * @param {string} agentId 
   */
  updateHeartbeat(agentId) {
    const state = this.states.get(agentId);
    if (!state) return;
    
    const now = Date.now();
    state.lastHeartbeat = now;
    
    // 如果之前是 offline，恢复为 idle
    if (state.status === 'offline') {
      state.status = 'idle';
      this.log.info(`Agent ${agentId} recovered from offline`);
    }
    
    state.lastActivity = now;
  }

  /**
   * 标记为忙碌
   * @param {string} agentId 
   * @param {string} messageId 
   * @returns {boolean} 是否成功
   */
  markBusy(agentId, messageId) {
    const state = this.states.get(agentId);
    if (!state) return false;
    
    // 如果已经是 suspended，不允许操作
    if (state.status === 'suspended') {
      this.log.info(`Agent ${agentId} is suspended, cannot mark busy`);
      return false;
    }
    
    // 检查是否已经达到最大并发数
    if (state.processingMessages.length >= this.config.maxConcurrentMessages) {
      this.log.debug(`Agent ${agentId} already at max concurrent messages`);
      return false;
    }
    
    state.status = 'busy';
    state.processingMessages.push({
      messageId,
      startTime: Date.now()
    });
    state.lastActivity = Date.now();
    
    this.log.debug(`Agent ${agentId} marked busy with message ${messageId}`);
    return true;
  }

  /**
   * 标记为空闲
   * @param {string} agentId 
   * @param {string} messageId 可选，如果提供则只移除该消息
   * @returns {boolean} 是否成功
   */
  markIdle(agentId, messageId = null) {
    const state = this.states.get(agentId);
    if (!state) return false;
    
    // 移除处理中的消息
    if (messageId) {
      state.processingMessages = state.processingMessages.filter(
        m => m.messageId !== messageId
      );
    } else {
      state.processingMessages = [];
    }
    
    // 如果还有处理中的消息，保持 busy
    if (state.processingMessages.length > 0) {
      this.log.debug(`Agent ${agentId} still has ${state.processingMessages.length} messages in progress`);
      return true;
    }
    
    // 只有非 suspended 状态才能转为 idle
    if (state.status !== 'suspended') {
      state.status = 'idle';
      state.processedCount++;
      state.lastActivity = Date.now();
      this.log.debug(`Agent ${agentId} marked idle`);
    }
    
    return true;
  }

  /**
   * 标记为挂起
   * @param {string} agentId 
   * @param {string} reason 
   * @returns {boolean} 是否成功
   */
  markSuspended(agentId, reason) {
    const state = this.states.get(agentId);
    if (!state) return false;
    
    const previousStatus = state.status;
    state.status = 'suspended';
    state.suspendedAt = Date.now();
    state.suspendReason = reason;
    
    this.log.info(`Agent ${agentId} suspended: ${reason}`);
    
    return true;
  }

  /**
   * 恢复挂起的 Agent
   * @param {string} agentId 
   * @param {boolean} clearQueue 是否清空队列
   * @returns {object|null} 恢复结果
   */
  resume(agentId, clearQueue = false) {
    const state = this.states.get(agentId);
    if (!state) return null;
    
    if (state.status !== 'suspended') {
      return { success: false, reason: 'Agent is not suspended' };
    }
    
    const previousStatus = state.status;
    const droppedMessages = state.queueSize;
    
    state.status = 'idle';
    state.suspendedAt = null;
    state.suspendReason = null;
    state.lastActivity = Date.now();
    
    if (clearQueue) {
      state.queueSize = 0;
    }
    
    this.log.info(`Agent ${agentId} resumed from suspended`);
    
    return {
      success: true,
      previousStatus,
      currentStatus: 'idle',
      queueCleared: clearQueue,
      droppedMessages: clearQueue ? droppedMessages : 0
    };
  }

  /**
   * 标记为离线
   * @param {string} agentId 
   */
  markOffline(agentId) {
    const state = this.states.get(agentId);
    if (!state) return;
    
    state.status = 'offline';
    this.log.info(`Agent ${agentId} marked offline`);
  }

  /**
   * 检查 Agent 是否可接收消息
   * @param {string} agentId 
   * @returns {object} { canReceive: boolean, reason?: string }
   */
  canReceiveMessage(agentId) {
    const state = this.states.get(agentId);
    
    if (!state) {
      return { canReceive: false, reason: 'agent_not_found' };
    }
    
    if (state.status === 'suspended') {
      return { 
        canReceive: false, 
        reason: 'agent_suspended',
        suspendedAt: state.suspendedAt,
        suspendReason: state.suspendReason
      };
    }
    
    if (state.status === 'offline') {
      return { canReceive: false, reason: 'agent_offline' };
    }
    
    // idle 或 busy 都可以接收消息（进入队列）
    return { canReceive: true };
  }

  /**
   * 获取 Agent 状态
   * @param {string} agentId 
   * @returns {object|null}
   */
  getState(agentId) {
    return this.states.get(agentId) || null;
  }

  /**
   * 获取所有 Agent 状态
   * @returns {Array}
   */
  getAllStates() {
    return Array.from(this.states.values());
  }

  /**
   * 按 status 获取 Agent 列表
   * @param {string} status 
   * @returns {Array}
   */
  getByStatus(status) {
    return Array.from(this.states.values()).filter(s => s.status === status);
  }

  /**
   * 按 role 获取 Agent 列表
   * @param {string} role 
   * @returns {Array}
   */
  getByRole(role) {
    return Array.from(this.states.values()).filter(s => s.role === role);
  }

  /**
   * 获取空闲的 Agent 列表
   * @returns {Array}
   */
  getIdleAgents() {
    return Array.from(this.states.values()).filter(s => s.status === 'idle');
  }

  /**
   * 更新队列大小
   * @param {string} agentId 
   * @param {number} size 
   */
  updateQueueSize(agentId, size) {
    const state = this.states.get(agentId);
    if (state) {
      state.queueSize = size;
    }
  }

  /**
   * 检查超时
   * - busy 超时 → suspended
   * - 无心跳超时 → offline
   */
  checkTimeouts() {
    const now = Date.now();
    const busyTimeout = this.config.busyTimeout;
    const offlineTimeout = this.config.offlineTimeout;
    
    const suspendedAgents = [];
    const offlineAgents = [];
    
    for (const state of this.states.values()) {
      // 检查 busy 超时
      if (state.status === 'busy' && state.processingMessages.length > 0) {
        const firstMessage = state.processingMessages[0];
        if (now - firstMessage.startTime > busyTimeout) {
          this.markSuspended(state.id, `Processing timeout (${Math.round(busyTimeout / 60000)} minutes)`);
          suspendedAgents.push(state.id);
        }
      }
      
      // 检查心跳超时
      if (state.status !== 'offline' && state.status !== 'suspended') {
        if (now - state.lastHeartbeat > offlineTimeout) {
          this.markOffline(state.id);
          offlineAgents.push(state.id);
        }
      }
    }
    
    if (suspendedAgents.length > 0) {
      this.log.info(`Suspended agents: ${suspendedAgents.join(', ')}`);
    }
    
    if (offlineAgents.length > 0) {
      this.log.info(`Offline agents: ${offlineAgents.join(', ')}`);
    }
    
    return { suspendedAgents, offlineAgents };
  }

  /**
   * 获取 Agent 数量
   * @returns {number}
   */
  count() {
    return this.states.size;
  }

  /**
   * 获取统计信息
   * @returns {object}
   */
  getStats() {
    const states = Array.from(this.states.values());
    
    return {
      total: states.length,
      idle: states.filter(s => s.status === 'idle').length,
      busy: states.filter(s => s.status === 'busy').length,
      suspended: states.filter(s => s.status === 'suspended').length,
      offline: states.filter(s => s.status === 'offline').length
    };
  }

  /**
   * 注销 Agent
   * @param {string} agentId 
   * @returns {boolean}
   */
  unregisterAgent(agentId) {
    const deleted = this.states.delete(agentId);
    if (deleted) {
      this.log.info(`Agent unregistered: ${agentId}`);
    }
    return deleted;
  }
}

module.exports = { AgentStateManager };