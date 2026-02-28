# Pheromone 项目经验教训

## 2026-02-28 23:35 - 自动化触发问题

### 问题
- OpenClaw Gateway 是事件驱动的
- 没有外部指令输入，Agent 不会自动执行任务
- 共享文件队列只是移动文件，没有触发 Gateway

### 原因分析
1. Gateway 设计为 WebSocket + 事件驱动架构
2. 需要外部触发：Dashboard 消息、Webhook、CLI 命令
3. 我们的 Cron 脚本只在"读状态"，没有"写指令"

### 解决方案探索
1. ❌ Windows 任务计划 - 权限问题
2. ❌ 共享文件队列 - 只能传递状态，不能触发执行
3. 🔄 CLI 触发 - 正在研究正确方法
4. 🔄 HTTP API - 需要认证和正确的端点

### 学到的经验
- **事件驱动系统需要事件源**：不能只靠文件状态变化
- **Gateway 是核心**：所有 Agent 执行都通过 Gateway
- **认证是关键**：需要正确的 Token 和 API 端点

### 下一步行动
- 研究 `openclaw send` 命令
- 研究 Gateway HTTP API
- 考虑使用 Webhook 触发

---

## 2026-02-28 23:10 - 共享文件夹权限

### 问题
- Docker 容器需要访问主机上的共享文件夹
- 需要正确的挂载配置

### 解决方案
```yaml
volumes:
  - C:\openclaw-shared:/home/node/shared:rw
```

### 学到的经验
- Windows 路径在 Docker 中需要正确格式
- 确保 Docker Desktop 有文件共享权限

---

## 2026-02-28 23:00 - Windows 任务计划权限

### 问题
- 创建任务计划需要管理员权限
- 普通用户无法创建系统级任务

### 解决方案
- 使用 `schtasks` 命令配合 `/RU` 参数
- 或者手动通过 GUI 创建

### 学到的经验
- 自动化脚本需要考虑权限问题
- 提供多种配置方案（GUI 和 CLI）