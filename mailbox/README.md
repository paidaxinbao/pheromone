# Mailbox 协议设计

## 概述

Mailbox 是 Agent Swarm 的消息通信协议，用于：
- Agent 间消息传递
- 任务分配与追踪
- 状态同步
- 心跳检测

## 协议版本

- **版本**: 1.0.0
- **传输**: HTTP/WebSocket
- **格式**: JSON

## 消息类型

| 类型 | 方向 | 描述 |
|------|------|------|
| `task.assign` | Manager → Agent | 分配任务 |
| `task.update` | Agent → Manager | 更新任务状态 |
| `task.complete` | Agent → Manager | 任务完成 |
| `task.fail` | Agent → Manager | 任务失败 |
| `message.direct` | Agent ↔ Agent | 点对点消息 |
| `message.broadcast` | Manager → All | 广播消息 |
| `status.heartbeat` | Agent → Manager | 心跳 |
| `status.sync` | Manager ↔ Agent | 状态同步 |
| `handshake.register` | Agent → Manager | 注册 |
| `handshake.ack` | Manager → Agent | 注册确认 |

## 通信流程

```
Agent 启动
    │
    ├─→ handshake.register → Manager
    │       ↓
    │   handshake.ack ← Manager
    │
    ├─→ status.heartbeat (每 30s)
    │
    └─→ 接收 task.assign
            ↓
        task.update (进度更新)
            ↓
        task.complete / task.fail
```

## Schema 文件

- [envelope.schema.json](./schemas/envelope.schema.json) - 消息信封
- [task.schema.json](./schemas/task.schema.json) - 任务结构
- [agent.schema.json](./schemas/agent.schema.json) - Agent 信息
- [message.schema.json](./schemas/message.schema.json) - 消息体