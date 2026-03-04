/**
 * Per-Agent Message Queue - Per-Agent 消息队列
 * 
 * 职责:
 * - 为每个 Agent 维护独立队列
 * - 管理队列容量
 * - 处理队列满的情况
 * 
 * 队列策略:
 * - 容量限制: 每个 Agent 最多 50 条消息
 * - 队列满处理: 丢弃最旧的低优先级消息
 * - 排序策略: 当前 FIFO
 * 
 * @version 2.0.0
 */

const crypto = require('crypto');

class PerAgentQueue {
  constructor(config = {}) {
    this.config = {
      maxQueueSize: config.maxQueueSize || 50,
      dropStrategy: config.dropStrategy || 'oldest-low-priority',
      enablePrioritySort: config.enablePrioritySort || false
    };
    
    // Agent 队列存储
    // Map<agentId, Array<QueuedMessage>>
    this.queues = new Map();
    
    // 统计
    this.stats = {
      totalEnqueued: 0,
      totalDequeued: 0,
      totalDropped: 0
    };
    
    // 日志
    this.log = {
      info: (msg, ...args) => console.log(`[${new Date().toISOString()}] [PerAgentQueue] [INFO] ${msg}`, ...args),
      error: (msg, ...args) => console.error(`[${new Date().toISOString()}] [PerAgentQueue] [ERROR] ${msg}`, ...args),
      debug: (msg, ...args) => process.env.DEBUG && console.log(`[${new Date().toISOString()}] [PerAgentQueue] [DEBUG] ${msg}`, ...args)
    };
  }

  /**
   * 加入队列
   * @param {string} agentId 
   * @param {object} message 
   * @param {string} priority - urgent, high, normal, low
   * @returns {object} { success: boolean, messageId?: string, dropped?: number }
   */
  enqueue(agentId, message, priority = 'normal') {
    if (!this.queues.has(agentId)) {
      this.queues.set(agentId, []);
    }
    
    const queue = this.queues.get(agentId);
    const messageId = message._id || message.id || crypto.randomUUID();
    
    const queuedMessage = {
      ...message,
      _id: messageId,
      _priority: this.normalizePriority(priority),
      _enqueuedAt: Date.now()
    };
    
    // 检查队列容量
    if (queue.length >= this.config.maxQueueSize) {
      const dropResult = this.handleQueueFull(queue, queuedMessage._priority);
      
      if (!dropResult.canAdd) {
        this.log.info(`Queue full for ${agentId}, message rejected: ${messageId}`);
        return { success: false, reason: 'queue_full' };
      }
      
      this.stats.totalDropped += dropResult.dropped;
      this.log.info(`Queue full for ${agentId}, dropped ${dropResult.dropped} messages`);
    }
    
    queue.push(queuedMessage);
    this.stats.totalEnqueued++;
    
    this.log.debug(`Enqueued message ${messageId} for ${agentId} (queue: ${queue.length})`);
    
    return { 
      success: true, 
      messageId,
      queueSize: queue.length 
    };
  }

  /**
   * 从队列取出消息
   * @param {string} agentId 
   * @param {number} limit 
   * @returns {Array}
   */
  dequeue(agentId, limit = 1) {
    const queue = this.queues.get(agentId);
    if (!queue || queue.length === 0) {
      return [];
    }
    
    // 如果启用优先级排序，先排序
    if (this.config.enablePrioritySort) {
      this.sortByPriority(queue);
    }
    
    const messages = queue.splice(0, limit);
    this.stats.totalDequeued += messages.length;
    
    this.log.debug(`Dequeued ${messages.length} messages for ${agentId} (remaining: ${queue.length})`);
    
    return messages;
  }

  /**
   * 获取队列大小
   * @param {string} agentId 
   * @returns {number}
   */
  getQueueSize(agentId) {
    const queue = this.queues.get(agentId);
    return queue ? queue.length : 0;
  }

  /**
   * 获取队列内容（不移除）
   * @param {string} agentId 
   * @param {number} limit 
   * @returns {Array}
   */
  peek(agentId, limit = 10) {
    const queue = this.queues.get(agentId);
    if (!queue) return [];
    
    return queue.slice(0, limit);
  }

  /**
   * 清空队列
   * @param {string} agentId 
   * @returns {number} 清空的消息数量
   */
  clearQueue(agentId) {
    const queue = this.queues.get(agentId);
    if (!queue) return 0;
    
    const count = queue.length;
    queue.length = 0;
    
    this.log.info(`Cleared queue for ${agentId} (${count} messages)`);
    
    return count;
  }

  /**
   * 获取所有队列状态
   * @returns {object}
   */
  getAllQueues() {
    const result = {};
    
    for (const [agentId, queue] of this.queues) {
      result[agentId] = {
        size: queue.length,
        oldestMessage: queue.length > 0 ? new Date(queue[0]._enqueuedAt).toISOString() : null,
        newestMessage: queue.length > 0 ? new Date(queue[queue.length - 1]._enqueuedAt).toISOString() : null,
        priorities: this.getQueuePriorityStats(queue)
      };
    }
    
    return result;
  }

  /**
   * 获取总消息数
   * @returns {number}
   */
  getTotalSize() {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * 处理队列满的情况
   * @param {Array} queue 
   * @param {string} newPriority 
   * @returns {object} { canAdd: boolean, dropped: number }
   */
  handleQueueFull(queue, newPriority) {
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    const newPriorityValue = priorityOrder[newPriority] || 2;
    
    // 如果新消息是 low 优先级，直接拒绝
    if (newPriorityValue >= 3) {
      return { canAdd: false, dropped: 0 };
    }
    
    // 尝试丢弃 low 优先级消息
    let dropped = 0;
    
    // 首先尝试丢弃 low 优先级
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i]._priority === 'low') {
        queue.splice(i, 1);
        dropped++;
        this.log.debug(`Dropped low priority message: ${queue[i]?._id}`);
        break;
      }
    }
    
    // 如果没有 low，尝试丢弃 normal
    if (dropped === 0 && newPriorityValue < 2) {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i]._priority === 'normal') {
          queue.splice(i, 1);
          dropped++;
          this.log.debug(`Dropped normal priority message: ${queue[i]?._id}`);
          break;
        }
      }
    }
    
    // 如果都没有，且新消息是 high 或 urgent，丢弃最旧的 normal
    if (dropped === 0 && newPriorityValue < 1) {
      for (let i = 0; i < queue.length; i++) {
        if (queue[i]._priority === 'normal' || queue[i]._priority === 'low') {
          queue.splice(i, 1);
          dropped++;
          this.log.debug(`Dropped oldest low/normal priority message`);
          break;
        }
      }
    }
    
    return { 
      canAdd: dropped > 0, 
      dropped 
    };
  }

  /**
   * 标准化优先级
   * @param {string} priority 
   * @returns {string}
   */
  normalizePriority(priority) {
    const validPriorities = ['urgent', 'high', 'normal', 'low'];
    const p = (priority || 'normal').toLowerCase();
    return validPriorities.includes(p) ? p : 'normal';
  }

  /**
   * 按优先级排序队列
   * @param {Array} queue 
   */
  sortByPriority(queue) {
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    
    queue.sort((a, b) => {
      const pa = priorityOrder[a._priority] || 2;
      const pb = priorityOrder[b._priority] || 2;
      
      if (pa !== pb) {
        return pa - pb; // 优先级低的数字排前面
      }
      
      return a._enqueuedAt - b._enqueuedAt; // 同优先级按时间排序
    });
  }

  /**
   * 获取队列优先级统计
   * @param {Array} queue 
   * @returns {object}
   */
  getQueuePriorityStats(queue) {
    const stats = { urgent: 0, high: 0, normal: 0, low: 0 };
    
    for (const msg of queue) {
      const p = msg._priority || 'normal';
      if (stats.hasOwnProperty(p)) {
        stats[p]++;
      }
    }
    
    return stats;
  }

  /**
   * 获取所有队列的总消息数
   * @returns {number}
   */
  getTotalQueued() {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * 获取统计信息
   * @returns {object}
   */
  getStats() {
    return {
      ...this.stats,
      totalQueues: this.queues.size,
      totalMessages: this.getTotalQueued()
    };
  }
}

module.exports = { PerAgentQueue };