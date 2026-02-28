# Agent Swarm - 启动指南

## 快速开始

### 方式一：本地运行（开发测试）

**1. 启动 Mailbox Hub**
```bash
cd agent-swarm
npm install
npm run start:hub
```

Hub 将在 http://localhost:18790 运行

**2. 启动 Agent（新终端）**
```bash
npm run start:dev    # Developer Agent
npm run start:reviewer  # Reviewer Agent
npm run start:test   # Tester Agent
```

### 方式二：Docker 运行（生产环境）

**1. 构建并启动所有容器**
```bash
cd agent-swarm/docker
docker-compose up -d --build
```

**2. 查看状态**
```bash
docker-compose ps
docker-compose logs -f
```

**3. 停止**
```bash
docker-compose down
```

## API 接口

### Mailbox Hub API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/register` | POST | Agent 注册 |
| `/message` | POST | 发送消息 |
| `/messages?agentId=x` | GET | 获取消息 |
| `/status` | POST | 更新状态 |
| `/agents` | GET | 获取所有 Agent 状态 |
| `/task` | POST | 注册任务 |
| `/tasks` | GET | 获取所有任务 |

### 示例

**注册 Agent:**
```bash
curl -X POST http://localhost:18790/register \
  -H "Content-Type: application/json" \
  -d '{"agentId":"developer","role":"developer"}'
```

**发送消息:**
```bash
curl -X POST http://localhost:18790/message \
  -H "Content-Type: application/json" \
  -d '{
    "from":"manager",
    "to":"developer",
    "type":"task_assign",
    "content":{"task_id":"TASK-001","title":"开发功能"}
  }'
```

**获取 Agent 状态:**
```bash
curl http://localhost:18790/agents
```

## 项目结构

```
agent-swarm/
├── mailbox/           # Mailbox 通信系统
│   ├── protocol.js   # 通信协议
│   └── hub.js        # 消息中转站
├── agents/           # Agent 配置
│   ├── developer/    # 开发者 Agent
│   ├── reviewer/     # 审查者 Agent
│   └── tester/       # 测试者 Agent
├── manager/          # 管理者配置
├── docker/           # Docker 配置
└── package.json      # 项目配置
```

## 故障排查

**Hub 无法启动:**
```bash
# 检查端口占用
netstat -ano | findstr :18790
```

**Agent 无法连接 Hub:**
```bash
# 检查 Hub 是否运行
curl http://localhost:18790/health
```

**Docker 容器无法通信:**
```bash
# 检查网络
docker network ls
docker-compose -f docker/docker-compose.yml config
```

## 下一步

1. 启动 Mailbox Hub
2. 启动各个 Agent
3. 通过 Manager 分配任务
4. 观察 Agent 协作