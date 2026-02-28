# Pheromone Agent Swarm 自动化流程

## 系统架构

```
每 10 分钟循环
    ↓
┌─────────────────────────────────┐
│   Orchestrator (自动触发器)     │
│  - 检查 GitHub Issues 状态       │
│  - 读取 Agent 状态文件            │
│  - 生成进度报告                  │
│  - 记录到日志                    │
└──────────────┬──────────────────┘
               │
               ↓
        ┌──────────────┐
        │  飞书汇报     │
        │  (每 10 分钟)   │
        └──────────────┘
```

## Agent 状态机

```
┌─────────┐
│  IDLE   │ ← 任务完成，等待新任务
│  空闲   │
└────┬────┘
     │ 分配任务
     ↓
┌─────────┐
│ WORKING │ ← 正在执行任务
│  工作中  │
└────┬────┘
     │ 完成任务
     ↓
┌─────────┐
│ PENDING │ ← 等待审核/下一阶段
│  待审核  │
└─────────┘
```

## 自动化流程

### 1. Orchestrator 触发（每 10 分钟）

**脚本**: `orchestrator.ps1`

**执行内容**:
1. 检查 GitHub Issues 状态
2. 读取各 Agent 的 `shared-tasks/*.status.md`
3. 判断每个 Agent 的状态（IDLE/WORKING/PENDING）
4. 生成进度报告
5. 记录到日志文件

### 2. 进度汇报

**汇报内容**:
- 各 Agent 当前状态
- 当前任务进度
- 完成的任务
- 阻塞问题

**汇报方式**:
- 更新 `PROGRESS.md`
- 飞书消息（手动或自动）
- GitHub Issue 评论

### 3. 任务分配

**规则**:
- **IDLE** → 分配新任务（从 GitHub Issues 选择）
- **WORKING** → 询问进度，督促完成
- **PENDING** → 确认完成，准备下一阶段

---

## 设置定时任务

### Windows 任务计划程序

**手动创建步骤**:

1. 打开 **任务计划程序** (taskschd.msc)

2. 点击 **创建基本任务**

3. 配置:
   - **名称**: `Pheromone-Orchestrator`
   - **触发器**: 一次
   - **开始时间**: 当前时间 +2 分钟
   - **重复**: 每 10 分钟
   - **操作**: 启动程序
   - **程序**: `PowerShell.exe`
   - **参数**: `-NoProfile -ExecutionPolicy Bypass -File "C:\Users\panxinyu\.openclaw\workspace\agent-swarm\orchestrator.ps1"`
   - **起始于**: `C:\Users\panxinyu\.openclaw\workspace\agent-swarm`

4. 完成创建

5. 右键任务 → **属性** → 勾选 **使用最高权限运行**

### 验证任务

```powershell
# 查看任务状态
Get-ScheduledTask -TaskName "Pheromone-Orchestrator"

# 手动触发测试
Start-ScheduledTask -TaskName "Pheromone-Orchestrator"

# 查看任务历史
Get-ScheduledTaskInfo -TaskName "Pheromone-Orchestrator"
```

---

## 文件结构

```
agent-swarm/
├── orchestrator.ps1          # 主协调器脚本（每 10 分钟运行）
├── check-progress-cron.ps1   # 备用检查脚本
├── PROGRESS.md               # 进度追踪文件
├── shared-tasks/
│   ├── developer.status.md   # Developer 状态
│   ├── reviewer.status.md    # Reviewer 状态
│   └── tester.status.md      # Tester 状态
├── orchestrator.log          # 运行日志
└── AUTOMATION.md             # 本文档
```

---

## Agent 状态文件格式

```markdown
# [Agent Name] Status

**Last Update**: 2026-02-28 20:30

## Current Task
TASK-001: Mailbox Protocol Design - 50% Complete

## Progress Log
| Time | Task | Status | Notes |
|------|------|--------|-------|
| 20:15 | Message format design | Done | 7 fields defined |
| 20:30 | Message types | In Progress | 5 of 8 completed |

## Next Steps
- Complete message types definition
- Start protocol.js implementation
```

---

## 故障排除

### Orchestrator 不运行

1. 检查任务计划程序
2. 查看日志文件 `orchestrator.log`
3. 手动运行测试：`.\orchestrator.ps1`

### Agent 状态不更新

1. 检查 Agent 是否在工作
2. 查看 Gateway 日志
3. 确认状态文件路径正确

### GitHub API 限流

- Token 有速率限制
- 如遇到限流，等待 1 小时或增加 Token

---

## 下一步优化

1. **自动飞书汇报**: 集成飞书 API 自动发送进度
2. **智能任务分配**: 根据 Agent 能力自动分配
3. **依赖管理**: 自动处理任务依赖关系
4. **异常检测**: 发现阻塞自动通知用户

---

**文档版本**: 1.0  
**最后更新**: 2026-02-28 20:37