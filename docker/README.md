# Agent Swarm - Docker 部署指南

## 重要说明

OpenClaw **没有官方预构建的 Docker 镜像**，需要本地构建。

由于构建复杂（需要 Node.js 22+ 和大量依赖），建议使用以下替代方案：

---

## 方案：本地运行多个 Agent（推荐）

不使用 Docker，直接在本地运行 3 个独立的 OpenClaw 实例：

### 1. 创建 3 个工作空间

```powershell
# Developer Agent
mkdir ~/.openclaw/agent-developer
cp agents/developer/SOUL.md ~/.openclaw/agent-developer/
cp agents/developer/AGENTS.md ~/.openclaw/agent-developer/

# Reviewer Agent
mkdir ~/.openclaw/agent-reviewer
cp agents/reviewer/SOUL.md ~/.openclaw/agent-reviewer/
cp agents/reviewer/AGENTS.md ~/.openclaw/agent-reviewer/

# Tester Agent
mkdir ~/.openclaw/agent-tester
cp agents/tester/SOUL.md ~/.openclaw/agent-tester/
cp agents/tester/AGENTS.md ~/.openclaw/agent-tester/
```

### 2. 配置每个 Agent

在每个目录创建 `openclaw.json`：

```json
{
  "agent": {
    "model": "bailian/qwen3.5-plus"
  },
  "gateway": {
    "bind": "127.0.0.1",
    "port": 18791
  }
}
```

**注意：** 每个 Agent 使用不同端口：
- Developer: 18791
- Reviewer: 18792
- Tester: 18793

### 3. 启动 3 个 Gateway

```powershell
# Terminal 1 - Developer
cd ~/.openclaw/agent-developer
openclaw gateway --port 18791

# Terminal 2 - Reviewer
cd ~/.openclaw/agent-reviewer
openclaw gateway --port 18792

# Terminal 3 - Tester
cd ~/.openclaw/agent-tester
openclaw gateway --port 18793
```

### 4. 与 Agent 对话

使用飞书或其他方式连接到不同端口的 Gateway。

---

## Docker 方案（高级用户）

如果你坚持使用 Docker，需要：

1. 克隆 OpenClaw 主仓库
2. 运行 `./docker-setup.sh` 构建镜像
3. 修改 docker-compose.yml 使用本地镜像

参考：https://docs.openclaw.ai/install/docker