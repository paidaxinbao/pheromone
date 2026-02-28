/**
 * Mailbox Protocol - Agent 间通信协议
 * 
 * 消息格式:
 * {
 *   id: string,          // 消息唯一ID
 *   from: string,        // 发送者 Agent ID
 *   to: string,          // 接收者 Agent ID | "broadcast" | "manager"
 *   type: MessageType,   // 消息类型
 *   content: any,        // 消息内容
 *   timestamp: string,   // ISO 时间戳
 *   priority: number,    // 优先级 1-5 (1最高)
 *   metadata: object     // 额外元数据
 * }
 */

const MESSAGE_TYPES = {
  // 任务相关
  TASK_ASSIGN: 'task_assign',           // 分配任务
  TASK_UPDATE: 'task_update',           // 任务进度更新
  TASK_COMPLETE: 'task_complete',       // 任务完成
  TASK_FAILED: 'task_failed',           // 任务失败
  
  // 通信相关
  MESSAGE: 'message',                   // 普通消息
  QUESTION: 'question',                 // 提问
  ANSWER: 'answer',                     // 回答
  NOTIFICATION: 'notification',         // 通知
  
  // 协作相关
  CODE_REVIEW_REQUEST: 'code_review_request',   // 代码审查请求
  CODE_REVIEW_RESULT: 'code_review_result',     // 代码审查结果
  TEST_REQUEST: 'test_request',                 // 测试请求
  TEST_RESULT: 'test_result',                   // 测试结果
  
  // 状态相关
  STATUS_REPORT: 'status_report',       // 状态报告
  HEARTBEAT: 'heartbeat',               // 心跳
  ERROR: 'error',                       // 错误报告
  
  // 确认相关 (新增)
  ACK: 'ack',                           // 消息确认
  NACK: 'nack',                         // 消息拒绝
  PING: 'ping',                         // 连接检测
  PONG: 'pong'                          // 连接响应
};

const AGENT_ROLES = {
  MANAGER: 'manager',
  DEVELOPER: 'developer',
  REVIEWER: 'reviewer',
  TESTER: 'tester'
};

const MESSAGE_PRIORITY = {
  CRITICAL: 1,   // 紧急：错误、阻塞
  HIGH: 2,       // 高：任务分配、完成
  NORMAL: 3,     // 普通：日常通信
  LOW: 4,        // 低：状态报告
  BACKGROUND: 5  // 后台：心跳
};

/**
 * 创建消息
 */
function createMessage(from, to, type, content, options = {}) {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from,
    to,
    type,
    content,
    timestamp: new Date().toISOString(),
    priority: options.priority || MESSAGE_PRIORITY.NORMAL,
    metadata: options.metadata || {}
  };
}

/**
 * 验证消息格式
 */
function validateMessage(msg) {
  const required = ['id', 'from', 'to', 'type', 'content', 'timestamp'];
  for (const field of required) {
    if (!(field in msg)) {
      return { valid: false, error: `Missing field: ${field}` };
    }
  }
  
  if (!Object.values(MESSAGE_TYPES).includes(msg.type)) {
    return { valid: false, error: `Invalid message type: ${msg.type}` };
  }
  
  return { valid: true };
}

module.exports = {
  MESSAGE_TYPES,
  AGENT_ROLES,
  MESSAGE_PRIORITY,
  createMessage,
  validateMessage
};