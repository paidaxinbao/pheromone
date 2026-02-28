# Mailbox 协议设计

## 概述

Mailbox 是 Agent Swarm 的消息通信协议，用于：
- Agent 间消息传递
- 任务分配与追踪
- 状态同步
- 心跳检测
- 可靠消息投递

## 协议版本

- **版本**: 1.1.0
- **传输**: HTTP/WebSocket
- **格式**: JSON

## 消息类型

### 任务相关

| 类型 | 方向 | 描述 |
|------|------|------|
| `task_assign` | Manager → Agent | 分配任务 |
| `task_update` | Agent → Manager | 更新任务状态 |
| `task_complete` | Agent → Manager | 任务完成 |
| `task_failed` | Agent → Manager | 任务失败 |

### 通信相关

| 类型 | 方向 | 描述 |
|------|------|------|
| `message` | Agent ↔ Agent | 普通消息 |
| `question` | Agent → Agent | 提问 |
| `answer` | Agent → Agent | 回答 |
| `notification` | Any → Any | 通知 |

### 协作相关

| 类型 | 方向 | 描述 |
|------|------|------|
| `code_review_request` | Developer → Reviewer | 代码审查请求 |
| `code_review_result` | Reviewer → Developer | 代码审查结果 |
| `test_request` | Developer → Tester | 测试请求 |
| `test_result` | Tester → Developer | 测试结果 |

### 状态相关

| 类型 | 方向 | 描述 |
|------|------|------|
| `status_report` | Agent → Manager | 状态报告 |
| `heartbeat` | Agent → Manager | 心跳 |
| `error` | Agent → Manager | 错误报告 |

### 可靠性相关 (v1.1新增)

| 类型 | 方向 | 描述 |
|------|------|------|
| `ack` | Receiver → Sender | 消息确认 |
| `nack` | Receiver → Sender | 消息拒绝 |
| `ping` | Any → Any | 连接检测 |
| `pong` | Any → Any | 连接响应 |

## 消息格式

### 基础结构

```json
{
  "id": "msg-1709000000000-abc123def",
  "from": "agent-developer-001",
  "to": "agent-reviewer-001",
  "type": "code_review_request",
  "content": { ... },
  "timestamp": "2026-03-01T00:00:00.000Z",
  "priority": 3,
  "metadata": {
    "correlationId": null,
    "ttl": 3600,
    "requiresAck": true
  }
}
```

### 可靠性元数据

```json
{
  "metadata": {
    "correlationId": "msg-xxx",     // 关联消息ID（用于请求-响应）
    "ttl": 3600,                    // 存活时间（秒），0=永不过期
    "requiresAck": true,            // 是否需要确认
    "retryCount": 0,                // 已重试次数
    "maxRetries": 3,                // 最大重试次数
    "tags": ["urgent", "blocking"]  // 自定义标签
  }
}
```

## 可靠性机制

### 消息确认 (ACK/NACK)

**发送流程：**
```
Sender                          Receiver
   │                               │
   ├─→ message (requiresAck=true) ─→│
   │                               │
   │←───── ack/nack ───────────────┤
   │                               │
```

**ACK 格式：**
```json
{
  "id": "ack-1709000001000-xyz789",
  "from": "agent-reviewer-001",
  "to": "agent-developer-001",
  "type": "ack",
  "content": {
    "originalMessageId": "msg-xxx",
    "success": true,
    "timestamp": "2026-03-01T00:00:01.000Z"
  },
  "metadata": {
    "correlationId": "msg-xxx"
  }
}
```

**NACK 格式：**
```json
{
  "type": "nack",
  "content": {
    "originalMessageId": "msg-xxx",
    "success": false,
    "error": {
      "code": "AGENT_BUSY",
      "message": "Agent is currently processing another task"
    }
  }
}
```

### 重试策略

使用**指数退避 + 随机抖动**策略：

```javascript
// 配置
RELIABILITY_CONFIG = {
  ackTimeout: 30000,      // 确认超时：30秒
  maxRetries: 3,          // 最大重试：3次
  retryDelayBase: 1000,   // 延迟基数：1秒
  defaultTTL: 3600        // 默认TTL：1小时
}

// 重试延迟计算
delay(attempt) = baseDelay * 2^attempt + random(0, 25%)
// 第1次重试: ~1秒
// 第2次重试: ~2秒
// 第3次重试: ~4秒
// 最大延迟: 60秒
```

### 心跳机制

```
Agent                           Manager
   │                               │
   ├─→ heartbeat (every 30s) ─────→│
   │                               │
   │←─── ack ─────────────────────┤
   │                               │
   ... (3次心跳无响应 = 离线) ...
```

**心跳配置：**
```javascript
RELIABILITY_CONFIG = {
  heartbeatInterval: 30000,   // 心跳间隔：30秒
  heartbeatTimeout: 90000     // 超时阈值：90秒（3次）
}
```

## 通信流程

### Agent 注册流程

```
Agent 启动
    │
    ├─→ handshake.register → Manager
    │       ↓
    │   handshake.ack ← Manager
    │
    ├─→ heartbeat (每 30s)
    │
    └─→ 接收 task_assign
            ↓
        task_update (进度更新)
            ↓
        task_complete / task_failed
```

### 任务分配流程

```
Manager                     Developer                 Reviewer
    │                           │                         │
    ├─→ task_assign ───────────→│                         │
    │                           │                         │
    │←── ack ──────────────────┤                         │
    │                           │                         │
    │                           ├─→ code_review_request ─→│
    │                           │                         │
    │                           │←── ack ─────────────────┤
    │                           │                         │
    │                           │←── code_review_result ──┤
    │                           │                         │
    │                           ├─→ ack ─────────────────→│
    │                           │                         │
    │←── task_complete ─────────┤                         │
    │                           │                         │
    ├─→ ack ──────────────────→│                         │
```

## 消息优先级

| 级别 | 名称 | 用途 |
|------|------|------|
| 1 | CRITICAL | 错误、阻塞问题 |
| 2 | HIGH | 任务分配、完成 |
| 3 | NORMAL | 日常通信 |
| 4 | LOW | 状态报告 |
| 5 | BACKGROUND | 心跳 |

## Schema 文件

- [envelope.schema.json](./schemas/envelope.schema.json) - 消息信封
- [task.schema.json](./schemas/task.schema.json) - 任务结构
- [agent.schema.json](./schemas/agent.schema.json) - Agent 信息
- [message.schema.json](./schemas/message.schema.json) - 消息体

## 错误码

| 代码 | 描述 |
|------|------|
| `AGENT_BUSY` | Agent 正忙 |
| `AGENT_OFFLINE` | Agent 离线 |
| `INVALID_MESSAGE` | 消息格式无效 |
| `TASK_NOT_FOUND` | 任务不存在 |
| `UNAUTHORIZED` | 未授权 |
| `RATE_LIMITED` | 请求频率超限 |

## 版本历史

### v1.1.0 (2026-03-01)
- 新增 ACK/NACK 确认机制
- 新增重试策略（指数退避）
- 新增消息TTL过期处理
- 新增 ping/pong 连接检测

### v1.0.0 (2026-02-28)
- 初始版本
- 基础消息类型
- JSON Schema 定义
- HTTP API 实现