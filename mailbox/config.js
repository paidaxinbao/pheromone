/**
 * Mailbox Configuration v3
 * 
 * 配置说明:
 * - 核心组件配置：Agent 状态管理、消息队列、调度器、广播过滤
 * - 保护层配置：对话管理器、冷却期管理器
 * - 支持环境变量覆盖（Docker 部署用）
 * 
 * @version 3.0.0
 */

const env = (key, defaultVal, parser = parseInt) => {
  const val = process.env[key];
  if (val === undefined) return defaultVal;
  if (typeof defaultVal === 'boolean') {
    return val.toLowerCase() === 'true' || val === '1';
  }
  if (typeof defaultVal === 'number') {
    return parser(val);
  }
  return val;
};

module.exports = {
  // ===== 核心组件配置 =====
  
  // Agent 状态管理
  agentState: {
    maxConcurrentMessages: env('AGENT_STATE_MAX_CONCURRENT', 1),
    busyTimeout: env('AGENT_STATE_BUSY_TIMEOUT', 300000),
    offlineTimeout: env('AGENT_STATE_OFFLINE_TIMEOUT', 90000),
    suspendedAutoRecovery: env('AGENT_STATE_SUSPENDED_AUTO_RECOVERY', false)
  },

  // 消息队列
  messageQueue: {
    maxQueueSize: env('MESSAGE_QUEUE_MAX_SIZE', 50),
    dropStrategy: env('MESSAGE_QUEUE_DROP_STRATEGY', 'oldest-low-priority'),
    enablePrioritySort: env('MESSAGE_QUEUE_ENABLE_PRIORITY_SORT', false)
  },

  // 调度器
  scheduler: {
    interval: env('SCHEDULER_INTERVAL', 500),
    enabled: env('SCHEDULER_ENABLED', true),
    maxDeliveryRetries: env('SCHEDULER_MAX_DELIVERY_RETRIES', 3)
  },

  // 广播过滤
  broadcastFilter: {
    enabled: env('BROADCAST_ENABLED', true),
    maxRecipients: env('BROADCAST_MAX_RECIPIENTS', 4),
    minRecipients: env('BROADCAST_MIN_RECIPIENTS', 2),
    strategy: env('BROADCAST_STRATEGY', 'role-based'),
    fallbackToAll: env('BROADCAST_FALLBACK_TO_ALL', false)
  },

  // ===== 保护层配置 =====
  
  // 对话管理器（保护层）
  conversationManager: {
    enabled: env('CONVERSATION_ENABLED', true),
    maxMessagesIn5Minutes: env('CONVERSATION_MAX_MESSAGES_5MIN', 50),
    maxMessagesPerMinute: env('CONVERSATION_MAX_MESSAGES_1MIN', 10),
    expirationTime: env('CONVERSATION_EXPIRATION_TIME', 1800000),
    autoPauseEnabled: env('CONVERSATION_AUTO_PAUSE_ENABLED', true)
  },

  // 冷却期管理器（保护层）
  cooldownManager: {
    enabled: env('COOLDOWN_ENABLED', true),
    period: env('COOLDOWN_PERIOD', 3000),  // 临时方案：3 秒
    applyToAll: env('COOLDOWN_APPLY_TO_ALL', false)
  },

  // ===== 其他配置 =====
  
  // Hub 基础配置
  hub: {
    port: env('MAILBOX_PORT', 18888),
    host: env('MAILBOX_HOST', '0.0.0.0'),
    heartbeatInterval: env('HUB_HEARTBEAT_INTERVAL', 30000),
    heartbeatTimeout: env('HUB_HEARTBEAT_TIMEOUT', 90000),
    messageRetention: env('MESSAGE_RETENTION', 3600000),
    persistMessages: env('PERSIST_MESSAGES', true),
    callbackTimeout: env('CALLBACK_TIMEOUT', 10000),
    maxRetries: env('CALLBACK_MAX_RETRIES', 3)
  },

  // 优先级（暂不实现）
  priority: {
    enabled: false,
    starvationPrevention: false
  },

  // 日志
  logging: {
    level: env('LOG_LEVEL', 'info'),
    logStateChanges: env('LOG_STATE_CHANGES', true),
    logQueueOperations: env('LOG_QUEUE_OPERATIONS', true),
    logScheduling: env('LOG_SCHEDULING', true)
  }
};
