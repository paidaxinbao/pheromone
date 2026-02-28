# Agent Swarm - 部署指南

## 架构说明

```
┌─────────────────────────────────────────────────────────┐
│                    用户 (你)                             │
│              监督进度、审批决策                           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ GitHub 协作
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
┌───┴───┐        ┌─────┴─────┐      ┌─────┴─────┐
│Developer│      │ Reviewer  │      │ Tester    │
│(容器 1) │        │ (容器 2)    │      │ (容器 3)    │
│Port   │        │ Port      │      │ Port      │
│18791  │        │ 18792     │      │ 18793     │
└───┬───┘        └─────┬─────┘      └─────┬─────┘
    │                  │                  │
    └──────────────────┼──────────────────┘
                       │
                GitHub Repository
                paidaxinbao/agent-swarm
```

## 启动步骤

### 1. 准备 GitHub Token

创建 `.env` 文件在 `docker/` 目录：
```bash
GITHUB_TOKEN=github_pat_xxx
```

### 2. 构建并启动容器

```bash
cd agent-swarm/docker
docker-compose up -d --build
```

### 3. 查看状态

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f developer
docker-compose logs -f reviewer
docker-compose logs -f tester

# 访问 Agent Gateway
curl http://localhost:18791/health  # Developer
curl http://localhost:18792/health  # Reviewer
curl http://localhost:18793/health  # Tester
```

### 4. 与 Agent 交互

每个 Agent 运行独立的 OpenClaw Gateway，可以通过以下方式交互：

**方式一：CLI**
```bash
openclaw agent --message "开始开发 Mailbox 项目" --gateway http://localhost:18791
```

**方式二：飞书/其他渠道**
- 每个 Agent 可以配置独立的通信渠道
- 通过不同渠道与不同 Agent 交流

### 5. GitHub 协作流程

```
1. Developer 创建分支 → 实现功能 → 提交 PR
2. Reviewer 审查 PR → 提出意见 → 批准/要求修改
3. Tester 测试功能 → 报告 Bug → 验证修复
4. 合并到 main 分支
```

## 停止容器

```bash
docker-compose down
```

## 清理

```bash
docker-compose down -v  # 删除数据卷
docker-compose rm -f    # 删除容器
```

## 故障排查

**容器无法启动：**
```bash
docker-compose logs
docker ps -a
```

**GitHub 拉取失败：**
- 检查 GITHUB_TOKEN 是否有效
- 检查网络连接

**Agent 无响应：**
```bash
curl http://localhost:18791/health
docker restart agent-swarm-developer
```

## 下一步

1. 启动 3 个 Agent 容器
2. 分配初始任务给 Developer
3. 通过 GitHub 跟踪进度
4. 项目跑通后实现 Mailbox 通信