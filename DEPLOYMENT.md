# Pheromone Hub v3 部署指南

## 快速开始

### 方式 1：本地测试（无需 Docker）

```bash
# 进入 mailbox 目录
cd agent-swarm/mailbox

# 启动 Hub v3
node hub-v3.js
```

访问 http://localhost:18888/health 验证

### 方式 2：Docker Compose（推荐生产环境）

```bash
# 进入 agent-swarm 目录
cd agent-swarm

# 构建并启动所有服务
docker compose up -d

# 查看 Hub 日志
docker compose logs -f hub

# 查看健康状态
curl http://localhost:18888/health
```

### 方式 3：单独启动 Hub v3

```bash
cd agent-swarm

# 构建 Hub 镜像
docker compose build hub

# 启动 Hub
docker compose up -d hub

# 查看日志
docker logs -f pheromone-hub-v3
```

## 配置说明

### 环境变量配置

复制 `.env.example` 为 `.env` 并自定义配置：

```bash
cp .env.example .env
```

### 关键配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `MAILBOX_PORT` | 18888 | Hub 监听端口 |
| `AGENT_STATE_BUSY_TIMEOUT` | 300000 | Agent 忙碌超时（5 分钟） |
| `MESSAGE_QUEUE_MAX_SIZE` | 50 | 每 Agent 队列最大消息数 |
| `SCHEDULER_INTERVAL` | 500 | 调度器轮询间隔（毫秒） |
| `BROADCAST_MAX_RECIPIENTS` | 4 | 广播最多接收者数量 |
| `CONVERSATION_MAX_MESSAGES_5MIN` | 50 | 5 分钟内最大消息数 |
| `COOLDOWN_PERIOD` | 10000 | 冷却期（10 秒） |

### Docker 环境配置

在 `docker-compose.yml` 中配置环境变量：

```yaml
services:
  hub:
    environment:
      MAILBOX_PORT: "18888"
      BROADCAST_MAX_RECIPIENTS: "4"
      SCHEDULER_INTERVAL: "500"
      # ... 其他配置
```

## 健康检查

### API 端点

| 端点 | 说明 |
|------|------|
| `GET /health` | 健康检查 |
| `GET /agents` | 所有 Agent 状态 |
| `GET /agents/:id/state` | 单个 Agent 状态 |
| `GET /queues` | 所有队列状态 |
| `GET /scheduler/stats` | 调度器统计 |

### 示例

```bash
# 健康检查
curl http://localhost:18888/health

# 查看 Agent 列表
curl http://localhost:18888/agents

# 查看队列状态
curl http://localhost:18888/queues

# 查看调度器统计
curl http://localhost:18888/scheduler/stats
```

## 监控和日志

### Docker 日志

```bash
# 实时查看 Hub 日志
docker compose logs -f hub

# 查看最近 100 行
docker compose logs --tail=100 hub

# 查看特定时间段
docker compose logs --since="2026-03-04T10:00:00" --until="2026-03-04T12:00:00" hub
```

### 日志级别

通过 `LOG_LEVEL` 环境变量控制：

- `debug`: 详细调试信息
- `info`: 一般信息（默认）
- `warn`: 警告
- `error`: 错误

### 关键日志指标

**正常状态：**
```
[Hub] [INFO] Mailbox Hub v3.0 listening on http://0.0.0.0:18888
[Scheduler] [INFO] Scheduler started (interval: 500ms)
[StateManager] [INFO] Agent registered: xxx (role: xxx)
```

**需要关注：**
```
[Hub] [ERROR] Request error: ...
[Scheduler] [ERROR] Message delivery failed: ...
[StateManager] [INFO] Agent xxx suspended: ...
```

## 故障排查

### Hub 无法启动

1. 检查端口占用：
   ```bash
   netstat -ano | findstr :18888
   ```

2. 查看 Docker 日志：
   ```bash
   docker compose logs hub
   ```

3. 检查配置文件语法：
   ```bash
   node -c mailbox/config.js
   ```

### Agent 无法连接

1. 检查网络连通性：
   ```bash
   docker compose exec hub curl http://agent-name:9000/callback
   ```

2. 检查 Agent 注册状态：
   ```bash
   curl http://localhost:18888/agents
   ```

3. 查看队列消息：
   ```bash
   curl http://localhost:18888/queues
   ```

### 消息堆积

1. 查看队列大小：
   ```bash
   curl http://localhost:18888/queues | jq '.queues | to_entries | sort_by(.value.size) | reverse'
   ```

2. 检查 Agent 状态：
   ```bash
   curl http://localhost:18888/agents | jq '.agents[] | select(.status != "idle")'
   ```

3. 手动清空队列（谨慎使用）：
   ```bash
   curl -X DELETE http://localhost:18888/queues/agent-id
   ```

## 性能调优

### 高并发场景

```env
# 增加队列大小
MESSAGE_QUEUE_MAX_SIZE=100

# 加快调度频率
SCHEDULER_INTERVAL=250

# 增加广播接收者
BROADCAST_MAX_RECIPIENTS=6
```

### 防止消息爆炸

```env
# 降低对话限制
CONVERSATION_MAX_MESSAGES_5MIN=30
CONVERSATION_MAX_MESSAGES_1MIN=5

# 增加冷却期
COOLDOWN_PERIOD=30000
```

### 资源限制

在 `docker-compose.yml` 中添加：

```yaml
services:
  hub:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## 升级指南

### 从 Hub v2 升级到 v3

1. 备份数据：
   ```bash
   docker volume inspect agent-swarm_hub-data
   ```

2. 停止旧版本：
   ```bash
   docker compose down
   ```

3. 更新配置：
   ```bash
   git pull origin main
   ```

4. 重新构建：
   ```bash
   docker compose build hub
   ```

5. 启动新版本：
   ```bash
   docker compose up -d
   ```

6. 验证健康：
   ```bash
   curl http://localhost:18888/health
   ```

## 备份和恢复

### 备份消息数据

```bash
# 导出消息数据
docker compose exec hub tar czf /tmp/hub-data.tar.gz /app/data/messages

# 复制到本地
docker compose cp hub:/tmp/hub-data.tar.gz ./backup/
```

### 恢复消息数据

```bash
# 复制到容器
docker compose cp ./backup/hub-data.tar.gz hub:/tmp/

# 解压恢复
docker compose exec hub tar xzf /tmp/hub-data.tar.gz -C /
```

---

**文档版本**: v1.0  
**最后更新**: 2026-03-04  
**Hub 版本**: v3.0.0
