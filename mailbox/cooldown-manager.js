/**
 * Cooldown Manager - 冷却期管理器（保护层）
 * 
 * 职责:
 * - 强制隔离 Agent 之间的"小型消息循环"
 * - 防止"乒乓"式快速对话
 * 
 * 冷却逻辑:
 * {
 *   "agent-A->agent-B": lastMessageTime,
 *   "agent-B->agent-A": lastMessageTime
 * }
 * 
 * 规则:
 * - Agent A → Agent B 发送消息后，10 秒内不能再次发送
 * - 适用于一对一消息
 * - 可配置是否应用于广播
 * 
 * @version 2.0.0
 */

class CooldownManager {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      period: config.period || 10000,        // 10 秒冷却期
      applyToAll: config.applyToAll || false // 是否应用于广播
    };
    
    // 冷却记录
    // Map<"senderId->recipientId", lastMessageTime>
    this.cooldowns = new Map();
    
    // 统计
    this.stats = {
      totalChecks: 0,
      allowedMessages: 0,
      blockedMessages: 0
    };
    
    // 清理定时器（每 5 分钟清理过期记录）
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), 300000);
    
    // 日志
    this.log = {
      info: (msg, ...args) => console.log(`[${new Date().toISOString()}] [CooldownManager] [INFO] ${msg}`, ...args),
      debug: (msg, ...args) => process.env.DEBUG && console.log(`[${new Date().toISOString()}] [CooldownManager] [DEBUG] ${msg}`, ...args)
    };
  }

  /**
   * 生成冷却键
   * @param {string} senderId 
   * @param {string} recipientId 
   * @returns {string}
   */
  makeKey(senderId, recipientId) {
    return `${senderId}->${recipientId}`;
  }

  /**
   * 检查是否可以发送消息
   * @param {string} senderId 
   * @param {string} recipientId 
   * @returns {object} { allowed: boolean, reason?: string, retryAfter?: number }
   */
  canSendMessage(senderId, recipientId) {
    if (!this.config.enabled) {
      return { allowed: true };
    }
    
    const key = this.makeKey(senderId, recipientId);
    const lastMessageTime = this.cooldowns.get(key);
    
    this.stats.totalChecks++;
    
    if (lastMessageTime === undefined) {
      // 没有冷却记录，允许发送
      this.stats.allowedMessages++;
      return { allowed: true };
    }
    
    const now = Date.now();
    const elapsed = now - lastMessageTime;
    
    if (elapsed >= this.config.period) {
      // 冷却期已过，允许发送
      this.stats.allowedMessages++;
      return { allowed: true };
    }
    
    // 仍在冷却期内
    const retryAfter = this.config.period - elapsed;
    
    this.stats.blockedMessages++;
    this.log.debug(
      `Message blocked: ${senderId} → ${recipientId}, ` +
      `cooldown active (${Math.round(elapsed / 1000)}s / ${this.config.period / 1000}s)`
    );
    
    return {
      allowed: false,
      reason: 'Sender is in cooldown period',
      retryAfter: retryAfter,
      cooldownRemaining: retryAfter
    };
  }

  /**
   * 记录消息发送
   * @param {string} senderId 
   * @param {string} recipientId 
   */
  recordMessage(senderId, recipientId) {
    if (!this.config.enabled) {
      return;
    }
    
    const key = this.makeKey(senderId, recipientId);
    this.cooldowns.set(key, Date.now());
    
    this.log.debug(`Cooldown recorded: ${senderId} → ${recipientId}`);
  }

  /**
   * 检查广播消息
   * @param {string} senderId 
   * @param {Array} recipientIds 
   * @returns {object} { allowed: boolean, blockedRecipients: Array, allowedRecipients: Array }
   */
  checkBroadcast(senderId, recipientIds) {
    if (!this.config.enabled) {
      return {
        allowed: true,
        blockedRecipients: [],
        allowedRecipients: recipientIds
      };
    }
    
    // 如果配置为不应用于广播，直接允许
    if (!this.config.applyToAll) {
      return {
        allowed: true,
        blockedRecipients: [],
        allowedRecipients: recipientIds
      };
    }
    
    const blockedRecipients = [];
    const allowedRecipients = [];
    const now = Date.now();
    
    for (const recipientId of recipientIds) {
      const key = this.makeKey(senderId, recipientId);
      const lastMessageTime = this.cooldowns.get(key);
      
      if (lastMessageTime === undefined || (now - lastMessageTime) >= this.config.period) {
        allowedRecipients.push(recipientId);
      } else {
        blockedRecipients.push({
          recipientId,
          retryAfter: this.config.period - (now - lastMessageTime)
        });
      }
    }
    
    this.stats.totalChecks += recipientIds.length;
    this.stats.allowedMessages += allowedRecipients.length;
    this.stats.blockedMessages += blockedRecipients.length;
    
    return {
      allowed: allowedRecipients.length > 0,
      blockedRecipients,
      allowedRecipients
    };
  }

  /**
   * 清理过期记录
   */
  cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, lastTime] of this.cooldowns.entries()) {
      if (now - lastTime > this.config.period * 2) {
        this.cooldowns.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.log.debug(`Cleaned up ${cleaned} expired cooldown records`);
    }
  }

  /**
   * 获取冷却状态
   * @param {string} senderId 
   * @param {string} recipientId 
   * @returns {object}
   */
  getCooldownStatus(senderId, recipientId) {
    const key = this.makeKey(senderId, recipientId);
    const lastMessageTime = this.cooldowns.get(key);
    
    if (lastMessageTime === undefined) {
      return {
        inCooldown: false,
        lastMessage: null,
        remainingTime: 0
      };
    }
    
    const now = Date.now();
    const elapsed = now - lastMessageTime;
    const remaining = Math.max(0, this.config.period - elapsed);
    
    return {
      inCooldown: remaining > 0,
      lastMessage: new Date(lastMessageTime).toISOString(),
      elapsed: elapsed,
      remainingTime: remaining,
      period: this.config.period
    };
  }

  /**
   * 手动清除冷却
   * @param {string} senderId 
   * @param {string} recipientId 
   */
  clearCooldown(senderId, recipientId) {
    const key = this.makeKey(senderId, recipientId);
    this.cooldowns.delete(key);
    this.log.debug(`Cooldown cleared: ${senderId} → ${recipientId}`);
  }

  /**
   * 获取统计信息
   * @returns {object}
   */
  getStats() {
    return {
      ...this.stats,
      activeCooldowns: this.cooldowns.size,
      blockRate: this.stats.totalChecks > 0
        ? ((this.stats.blockedMessages / this.stats.totalChecks) * 100).toFixed(1) + '%'
        : '0%',
      config: {
        enabled: this.config.enabled,
        period: this.config.period,
        applyToAll: this.config.applyToAll
      }
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

  /**
   * 停止清理定时器
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

module.exports = { CooldownManager };
