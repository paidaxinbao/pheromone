/**
 * Conversation Manager - 对话管理器（保护层）
 * 
 * 职责:
 * - 跟踪对话整体状态
 * - 限制对话规模（5 分钟 50 条）
 * - 防止对话失控
 * 
 * 对话状态:
 * {
 *   id: "conv-xxx",
 *   participants: ["agent-A", "agent-B"],
 *   messages: [...],
 *   startTime: timestamp,
 *   messageCount: 15,
 *   status: "active"  // active | paused | closed
 * }
 * 
 * 限制规则:
 * - 5 分钟内最多 50 条消息
 * - 1 分钟内最多 10 条消息
 * - 30 分钟无活动自动关闭
 * 
 * @version 2.0.0
 */

const crypto = require('crypto');

class ConversationManager {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      maxMessagesIn5Minutes: config.maxMessagesIn5Minutes || 50,
      maxMessagesPerMinute: config.maxMessagesPerMinute || 10,
      expirationTime: config.expirationTime || 1800000,  // 30 分钟
      autoPauseEnabled: config.autoPauseEnabled || true
    };
    
    // 对话存储
    // Map<conversationId, Conversation>
    this.conversations = new Map();
    
    // 消息时间戳索引（用于快速计算）
    // Map<conversationId, Array<timestamp>>
    this.messageTimestamps = new Map();
    
    // 统计
    this.stats = {
      totalConversations: 0,
      activeConversations: 0,
      pausedConversations: 0,
      totalMessagesTracked: 0,
      messagesThrottled: 0
    };
    
    // 清理定时器
    this.cleanupTimer = null;
    
    // 日志
    this.log = {
      info: (msg, ...args) => console.log(`[${new Date().toISOString()}] [ConversationManager] [INFO] ${msg}`, ...args),
      warn: (msg, ...args) => console.warn(`[${new Date().toISOString()}] [ConversationManager] [WARN] ${msg}`, ...args),
      debug: (msg, ...args) => process.env.DEBUG && console.log(`[${new Date().toISOString()}] [ConversationManager] [DEBUG] ${msg}`, ...args)
    };
    
    // 启动清理定时器
    this.startCleanupTimer();
  }

  /**
   * 启动清理定时器
   */
  startCleanupTimer() {
    // 每分钟清理一次过期对话
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), 60000);
    this.log.debug('Cleanup timer started');
  }

  /**
   * 停止清理定时器
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 创建或获取对话
   * @param {Array} participants - 参与者 ID 列表
   * @returns {object} 对话对象
   */
  getOrCreateConversation(participants) {
    // 生成对话 ID（基于参与者排序）
    const sortedParticipants = [...participants].sort();
    const convId = `conv-${crypto.createHash('md5').update(sortedParticipants.join('|')).digest('hex').substring(0, 12)}`;
    
    if (this.conversations.has(convId)) {
      return this.conversations.get(convId);
    }
    
    const now = Date.now();
    const conversation = {
      id: convId,
      participants: sortedParticipants,
      messages: [],
      startTime: now,
      lastActivity: now,
      messageCount: 0,
      status: 'active',
      pausedAt: null,
      pausedReason: null
    };
    
    this.conversations.set(convId, conversation);
    this.messageTimestamps.set(convId, []);
    this.stats.totalConversations++;
    this.stats.activeConversations++;
    
    this.log.info(`Conversation created: ${convId} with ${participants.length} participants`);
    
    return conversation;
  }

  /**
   * 检查是否可以发送消息
   * @param {string} conversationId 
   * @returns {object} { allowed: boolean, reason?: string, retryAfter?: number }
   */
  canSendMessage(conversationId) {
    if (!this.config.enabled) {
      return { allowed: true };
    }
    
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      return { allowed: true };  // 新对话，允许
    }
    
    if (conversation.status === 'closed') {
      return { 
        allowed: false, 
        reason: 'Conversation closed',
        suggestion: 'Create a new conversation'
      };
    }
    
    if (conversation.status === 'paused') {
      return { 
        allowed: false, 
        reason: `Conversation paused: ${conversation.pausedReason}`,
        retryAfter: 60000  // 1 分钟后重试
      };
    }
    
    const now = Date.now();
    const timestamps = this.messageTimestamps.get(conversationId) || [];
    
    // 清理旧时间戳（超过 5 分钟）
    const fiveMinutesAgo = now - 300000;
    const recentTimestamps = timestamps.filter(t => t > fiveMinutesAgo);
    
    // 检查 5 分钟限制
    if (recentTimestamps.length >= this.config.maxMessagesIn5Minutes) {
      const oldestInWindow = Math.min(...recentTimestamps);
      const retryAfter = oldestInWindow + 300000 - now;
      
      this.stats.messagesThrottled++;
      this.log.warn(
        `Conversation ${conversationId} throttled: ` +
        `${recentTimestamps.length} messages in 5 minutes (limit: ${this.config.maxMessagesIn5Minutes})`
      );
      
      return {
        allowed: false,
        reason: 'Too many messages in 5 minutes',
        retryAfter: Math.max(0, retryAfter)
      };
    }
    
    // 检查 1 分钟限制
    const oneMinuteAgo = now - 60000;
    const lastMinuteTimestamps = recentTimestamps.filter(t => t > oneMinuteAgo);
    
    if (lastMinuteTimestamps.length >= this.config.maxMessagesPerMinute) {
      const oldestInWindow = Math.min(...lastMinuteTimestamps);
      const retryAfter = oldestInWindow + 60000 - now;
      
      this.stats.messagesThrottled++;
      this.log.warn(
        `Conversation ${conversationId} throttled: ` +
        `${lastMinuteTimestamps.length} messages in 1 minute (limit: ${this.config.maxMessagesPerMinute})`
      );
      
      return {
        allowed: false,
        reason: 'Too many messages in 1 minute',
        retryAfter: Math.max(0, retryAfter)
      };
    }
    
    return { allowed: true };
  }

  /**
   * 记录消息
   * @param {string} conversationId 
   * @param {object} message 
   */
  recordMessage(conversationId, message) {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      return;
    }
    
    const now = Date.now();
    
    // 更新对话状态
    conversation.messages.push({
      id: message.id,
      sender: message.sender?.id,
      timestamp: now
    });
    
    conversation.messageCount++;
    conversation.lastActivity = now;
    
    // 更新时间戳索引
    const timestamps = this.messageTimestamps.get(conversationId) || [];
    timestamps.push(now);
    this.messageTimestamps.set(conversationId, timestamps);
    
    this.stats.totalMessagesTracked++;
    
    this.log.debug(`Message recorded in ${conversationId} (total: ${conversation.messageCount})`);
  }

  /**
   * 暂停对话
   * @param {string} conversationId 
   * @param {string} reason 
   */
  pauseConversation(conversationId, reason = 'Manual pause') {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      return;
    }
    
    conversation.status = 'paused';
    conversation.pausedAt = Date.now();
    conversation.pausedReason = reason;
    
    this.stats.activeConversations--;
    this.stats.pausedConversations++;
    
    this.log.info(`Conversation ${conversationId} paused: ${reason}`);
  }

  /**
   * 恢复对话
   * @param {string} conversationId 
   */
  resumeConversation(conversationId) {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      return;
    }
    
    conversation.status = 'active';
    conversation.pausedAt = null;
    conversation.pausedReason = null;
    
    this.stats.pausedConversations--;
    this.stats.activeConversations++;
    
    this.log.info(`Conversation ${conversationId} resumed`);
  }

  /**
   * 关闭对话
   * @param {string} conversationId 
   */
  closeConversation(conversationId) {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      return;
    }
    
    conversation.status = 'closed';
    conversation.closedAt = Date.now();
    
    this.stats.activeConversations--;
    
    this.log.info(`Conversation ${conversationId} closed`);
  }

  /**
   * 清理过期对话
   */
  cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [convId, conversation] of this.conversations.entries()) {
      // 跳过活跃对话
      if (conversation.status === 'active') {
        const inactiveTime = now - conversation.lastActivity;
        
        if (inactiveTime > this.config.expirationTime) {
          this.log.info(`Conversation ${convId} expired after ${inactiveTime / 1000}s`);
          conversation.status = 'closed';
          this.stats.activeConversations--;
          cleaned++;
        }
        
        continue;
      }
      
      // 清理已关闭的对话（保留 5 分钟供查询）
      if (conversation.status === 'closed') {
        const closedTime = now - (conversation.closedAt || now);
        if (closedTime > 300000) {  // 5 分钟
          this.conversations.delete(convId);
          this.messageTimestamps.delete(convId);
          cleaned++;
        }
      }
    }
    
    if (cleaned > 0) {
      this.log.debug(`Cleaned up ${cleaned} expired conversations`);
    }
  }

  /**
   * 获取对话统计
   * @param {string} conversationId 
   * @returns {object}
   */
  getConversationStats(conversationId) {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      return null;
    }
    
    const now = Date.now();
    const timestamps = this.messageTimestamps.get(conversationId) || [];
    
    const fiveMinutesAgo = now - 300000;
    const oneMinuteAgo = now - 60000;
    
    return {
      id: conversation.id,
      participants: conversation.participants,
      status: conversation.status,
      messageCount: conversation.messageCount,
      duration: now - conversation.startTime,
      lastActivity: conversation.lastActivity,
      messagesIn5Minutes: timestamps.filter(t => t > fiveMinutesAgo).length,
      messagesIn1Minute: timestamps.filter(t => t > oneMinuteAgo).length,
      limits: {
        maxMessagesIn5Minutes: this.config.maxMessagesIn5Minutes,
        maxMessagesPerMinute: this.config.maxMessagesPerMinute
      }
    };
  }

  /**
   * 获取所有对话统计
   * @returns {object}
   */
  getStats() {
    return {
      ...this.stats,
      conversations: Array.from(this.conversations.values()).map(conv => ({
        id: conv.id,
        participants: conv.participants.length,
        status: conv.status,
        messageCount: conv.messageCount
      }))
    };
  }

  /**
   * 更新配置
   * @param {object} newConfig 
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    this.log.info('Config updated', newConfig);
  }
}

module.exports = { ConversationManager };
