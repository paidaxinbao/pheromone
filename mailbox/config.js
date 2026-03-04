/**
 * Mailbox Configuration
 * 
 * 配置说明:
 * - 核心组件配置: Agent状态管理、消息队列、调度器、广播过滤
 * - 保护层配置: 对话管理器、冷却期管理器
 * 
 * @version 2.0.0
 */

module.exports = {
  // ===== 核心组件配置 =====
  
  // Agent 状态管理
  agentState: {
    maxConcurrentMessages: 1,      // 每个Agent同时处理1条消息
    busyTimeout: 300000,            // 5分钟超时（毫秒）
    offlineTimeout: 90000,          // 90秒离线判定
    suspendedAutoRecovery: false    // 不自动恢复挂起的Agent
  },

  // 消息队列
  messageQueue: {
    maxQueueSize: 50,               // 每个Agent队列最大50条
    dropStrategy: 'oldest-low-priority',  // 丢弃策略
    enablePrioritySort: false       // TODO: 未来启用优先级排序
  },

  // 调度器
  scheduler: {
    interval: 500,                  // 0.5秒调度间隔（毫秒）
    enabled: true,
    maxDeliveryRetries: 3           // 最大重试次数
  },

  // 广播过滤
  broadcastFilter: {
    enabled: true,
    maxRecipients: 4,               // 最多4个接收者（宽松）
    minRecipients: 2,               // 最少2个接收者
    strategy: 'role-based',         // round-robin | random | role-based
    fallbackToAll: false            // 没有合适接收者时不发给所有人
  },

  // ===== 保护层配置 =====
  
  // 对话管理器（保护层）
  conversationManager: {
    enabled: true,
    maxMessagesIn5Minutes: 50,
    maxMessagesPerMinute: 10,
    expirationTime: 1800000,        // 30分钟（毫秒）
    autoPauseEnabled: true          // 自动暂停活跃对话
  },

  // 冷却期管理器（保护层）
  cooldownManager: {
    enabled: true,
    period: 10000,                  // 10秒冷却期（毫秒）
    applyToAll: false               // 不应用于广播消息
  },

  // ===== 其他配置 =====
  
  // Hub 基础配置
  hub: {
    port: process.env.MAILBOX_PORT || 18888,
    host: process.env.MAILBOX_HOST || '0.0.0.0',
    heartbeatInterval: 30000,
    heartbeatTimeout: 90000,
    messageRetention: 3600000,
    persistMessages: true,
    callbackTimeout: 10000,
    maxRetries: 3
  },

  // 优先级（暂不实现）
  priority: {
    enabled: false,                 // TODO: 未来实现优先级排序
    starvationPrevention: false     // TODO: 防止低优先级消息饿死
  },

  // 日志
  logging: {
    level: 'info',                  // debug | info | warn | error
    logStateChanges: true,          // 记录状态变化
    logQueueOperations: true,       // 记录队列操作
    logScheduling: true             // 记录调度过程
  }
};