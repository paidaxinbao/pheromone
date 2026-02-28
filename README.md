# Agent Swarm - 分布式 Agent 协作系统

一个基于 Docker 容器隔离的多 Agent 协作系统，通过 Mailbox 实现消息通信。

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    主机 OpenClaw                         │
│                  (Team Manager/Coordinator)              │
└──────────────────────┬──────────────────────────────────┘
                       │
              ┌────────┴────────┐
              │   Mailbox Hub   │
              │  (消息中转站)    │
              └────────┬────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
┌───┴───┐        ┌─────┴─────┐      ┌─────┴─────┐
│Developer│      │ Reviewer  │      │ Tester    │
│(沙盒)  │        │ (沙盒)    │      │ (沙盒)    │
└───────┘        └───────────┘      └───────────┘
```

## 快速开始

```bash
# 启动所有 Agent 容器
docker-compose up -d

# 查看容器状态
docker-compose ps

# 与特定 Agent 通信
curl http://localhost:8001/message -d '{"from":"manager","content":"hello"}'
```

## 目录结构

```
agent-swarm/
├── docker/
│   ├── Dockerfile.agent      # Agent 容器镜像
│   └── docker-compose.yml    # 容器编排配置
├── mailbox/
│   ├── hub.js               # 消息中转站
│   └── protocol.js          # 通信协议
├── agents/
│   ├── developer/           # 开发者 Agent
│   │   ├── SOUL.md
│   │   └── AGENTS.md
│   ├── reviewer/            # 审查者 Agent
│   │   ├── SOUL.md
│   │   └── AGENTS.md
│   └── tester/              # 测试者 Agent
│       ├── SOUL.md
│       └── AGENTS.md
└── manager/
    └── SOUL.md              # 管理者配置
```

## Agent 角色

| Agent | 职责 | 沙盒权限 |
|-------|------|----------|
| Developer | 编写代码、实现功能 | 文件读写、代码执行 |
| Reviewer | 代码审查、改进建议 | 只读访问 |
| Tester | 测试用例、验证功能 | 测试框架 |
| Manager | 任务分配、进度监督 | 全局协调 |

## 通信协议

```json
{
  "id": "msg-001",
  "from": "developer",
  "to": "reviewer",
  "type": "task_complete|task_update|question|notification",
  "content": "...",
  "timestamp": "2026-02-28T15:00:00Z",
  "metadata": {}
}
```

## License

MIT