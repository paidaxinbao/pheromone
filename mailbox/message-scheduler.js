/**
 * Message Scheduler - 消息调度器
 * 
 * 职责:
 * - 定期检查 Agent 状态
 * - 从队列取消息发送给空闲 Agent
 * - 处理超时 Agent
 * 
 * 调度逻辑:
 * 每隔 0.5 秒:
 *   1. 检查所有 Agent 状态
 *   2. 获取空闲的 Agent
 *   3. 为每个空闲 Agent:
 *      - 检查队列是否有消息
 *      - 取出消息
 *      - 检查是否可接收
 *      - 发送消息
 *      - 标记为 busy
 * 
 * @version 2.0.0
 */

class MessageScheduler {
  constructor(config = {}) {
    this.config = {
      interval: config.interval || 500,           // 0.5秒调度间隔
      enabled: config.enabled !== false,          // 默认启用
      maxDeliveryRetries: config.maxDeliveryRetries || 3
    };
    
    // 依赖注入
    this.stateManager = null;
    this.queue = null;
    this.dispatcher = null;
    this.registry = null;
    
    // 调度器状态
    this.timer = null;
    this.running = false;
    
    // 统计
    this.stats = {
      totalSchedules: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      lastScheduleTime: null
    };
    
    // 日志
    this.log = {
      info: (msg, ...args) => console.log(`[${new Date().toISOString()}] [Scheduler] [INFO] ${msg}`, ...args),
      error: (msg, ...args) => console.error(`[${new Date().toISOString()}] [Scheduler] [ERROR] ${msg}`, ...args),
      debug: (msg, ...args) => process.env.DEBUG && console.log(`[${new Date().toISOString()}] [Scheduler] [DEBUG] ${msg}`, ...args)
    };
  }

  /**
   * 初始化依赖
   * @param {object} dependencies 
   */
  init(dependencies) {
    this.stateManager = dependencies.stateManager;
    this.queue = dependencies.queue;
    this.dispatcher = dependencies.dispatcher;
    this.registry = dependencies.registry;
    
    this.log.info('Scheduler initialized with dependencies');
  }

  /**
   * 启动调度器
   */
  start() {
    if (this.running) {
      this.log.info('Scheduler already running');
      return;
    }
    
    if (!this.config.enabled) {
      this.log.info('Scheduler is disabled');
      return;
    }
    
    this.running = true;
    this.timer = setInterval(() => this.tick(), this.config.interval);
    
    this.log.info(`Scheduler started (interval: ${this.config.interval}ms)`);
  }

  /**
   * 停止调度器
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    this.running = false;
    this.log.info('Scheduler stopped');
  }

  /**
   * 调度周期
   */
  async tick() {
    this.stats.totalSchedules++;
    this.stats.lastScheduleTime = Date.now();
    
    try {
      // 1. 检查超时
      if (this.stateManager) {
        const { suspendedAgents, offlineAgents } = this.stateManager.checkTimeouts();
        
        if (suspendedAgents.length > 0) {
          this.log.info(`Timeout detected - suspended: ${suspendedAgents.join(', ')}`);
        }
      }
      
      // 2. 获取空闲 Agent
      const idleAgents = this.stateManager 
        ? this.stateManager.getIdleAgents()
        : [];
      
      if (idleAgents.length === 0) {
        this.log.debug('No idle agents');
        return;
      }
      
      this.log.debug(`Found ${idleAgents.length} idle agents`);
      
      // 3. 为每个空闲 Agent 尝试发送消息
      for (const agent of idleAgents) {
        await this.deliverNextMessage(agent);
      }
      
    } catch (error) {
      this.log.error(`Scheduler tick error: ${error.message}`);
    }
  }

  /**
   * 为 Agent 发送下一条消息
   * @param {object} agent 
   */
  async deliverNextMessage(agent) {
    const agentId = agent.id;
    const callbackUrl = agent.callbackUrl;
    
    // 检查队列是否有消息
    const queueSize = this.queue ? this.queue.getQueueSize(agentId) : 0;
    
    if (queueSize === 0) {
      this.log.debug(`No messages in queue for ${agentId}`);
      return;
    }
    
    // 检查 Agent 是否可接收
    if (this.stateManager) {
      const { canReceive, reason } = this.stateManager.canReceiveMessage(agentId);
      
      if (!canReceive) {
        this.log.debug(`Agent ${agentId} cannot receive: ${reason}`);
        return;
      }
    }
    
    // 如果没有 callbackUrl，不主动推送，等 Agent 自己来轮询
    if (!callbackUrl) {
      this.log.debug(`Agent ${agentId} has no callbackUrl, skipping push (agent should poll)`);
      return;
    }
    
    // 取出消息
    const messages = this.queue.dequeue(agentId, 1);
    
    if (messages.length === 0) {
      return;
    }
    
    const message = messages[0];
    const messageId = message._id || message.id;
    
    this.log.info(`Delivering message ${messageId} to ${agentId}`);
    
    // 标记为 busy
    if (this.stateManager) {
      this.stateManager.markBusy(agentId, messageId);
    }
    
    // 发送消息
    try {
      if (this.dispatcher) {
        const result = await this.dispatcher.push(agentId, message);
        
        if (result.delivered) {
          this.stats.successfulDeliveries++;
          this.log.info(`Message ${messageId} delivered to ${agentId}`);
        } else {
          this.stats.failedDeliveries++;
          this.log.error(`Message ${messageId} delivery failed: ${result.reason}`);
          
          // 如果发送失败，标记为 idle 以便重试
          if (this.stateManager) {
            this.stateManager.markIdle(agentId, messageId);
          }
        }
      } else {
        // 没有 dispatcher，消息已在队列中
        this.stats.successfulDeliveries++;
        this.log.info(`Message ${messageId} queued for ${agentId} (no dispatcher)`);
      }
      
      // 更新队列大小
      if (this.stateManager) {
        this.stateManager.updateQueueSize(agentId, this.queue.getQueueSize(agentId));
      }
      
    } catch (error) {
      this.stats.failedDeliveries++;
      this.log.error(`Message delivery error: ${error.message}`);
      
      // 恢复 Agent 状态
      if (this.stateManager) {
        this.stateManager.markIdle(agentId, messageId);
      }
    }
  }

  /**
   * 手动触发调度（用于测试或紧急情况）
   */
  async triggerNow() {
    this.log.info('Manual schedule trigger');
    await this.tick();
  }

  /**
   * 获取统计信息
   * @returns {object}
   */
  getStats() {
    return {
      enabled: this.config.enabled,
      running: this.running,
      interval: this.config.interval,
      ...this.stats,
      successRate: this.stats.totalSchedules > 0 
        ? (this.stats.successfulDeliveries / (this.stats.successfulDeliveries + this.stats.failedDeliveries) * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  /**
   * 更新配置
   * @param {object} newConfig 
   */
  updateConfig(newConfig) {
    if (newConfig.interval !== undefined) {
      this.config.interval = newConfig.interval;
      
      // 重启调度器以应用新间隔
      if (this.running) {
        this.stop();
        this.start();
      }
    }
    
    if (newConfig.enabled !== undefined) {
      this.config.enabled = newConfig.enabled;
      
      if (newConfig.enabled && !this.running) {
        this.start();
      } else if (!newConfig.enabled && this.running) {
        this.stop();
      }
    }
    
    this.log.info('Config updated', newConfig);
  }
}

module.exports = { MessageScheduler };