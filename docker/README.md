# Agent Swarm - Docker 部署

## 快速启动

### 1. 配置环境变量

复制 `.env.example` 为 `.env`：
```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 GitHub Token：
```
GITHUB_TOKEN=github_pat_xxx
```

### 2. 构建并启动

```bash
docker-compose up -d --build
```

### 3. 查看状态

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看单个 Agent 日志
docker-compose logs -f developer
docker-compose logs -f reviewer
docker-compose logs -f tester
```

### 4. 访问 Agent

每个 Agent 运行独立的 OpenClaw Gateway：

| Agent | 端口 | 说明 |
|-------|------|------|
| Developer | 18791 | 开发者 Agent |
| Reviewer | 18792 | 审查者 Agent |
| Tester | 18793 | 测试者 Agent |

测试连接：
```bash
curl http://localhost:18791/health
curl http://localhost:18792/health
curl http://localhost:18793/health
```

### 5. 停止

```bash
docker-compose down
```

## 与 Agent 交互

### 方式一：直接访问 Gateway

每个 Agent 的 Gateway 可以通过 HTTP 访问，但需要配置通信渠道（Telegram/飞书等）。

### 方式二：通过 GitHub

Agent 会：
1. 从 GitHub 拉取项目代码
2. 执行任务
3. 提交代码/PR 到 GitHub

你可以通过 GitHub 跟踪进度。

### 方式三：本地 OpenClaw

你可以用本地 OpenClaw 与各个 Agent 通信：

```bash
# 与 Developer 对话
openclaw agent --message "开始开发" --gateway http://localhost:18791

# 与 Reviewer 对话
openclaw agent --message "审查代码" --gateway http://localhost:18792
```

## 故障排查

**容器无法启动：**
```bash
docker-compose logs
```

**GitHub 拉取失败：**
- 检查 `.env` 文件中的 GITHUB_TOKEN
- 确认 Token 有 repo 权限

**Agent 无响应：**
```bash
docker-compose restart developer
curl http://localhost:18791/health
```

## 工作流程

```
1. 你在 GitHub 创建 Issue 分配任务
2. Developer 拉取代码 → 开发 → 提交 PR
3. Reviewer 审查 PR → 提出意见
4. Developer 修改 → 再次提交
5. Tester 测试 → 报告问题
6. 合并到 main 分支
```

## 下一步

项目初步完成后，实现 Mailbox 通信系统，让 Agent 可以直接通信。