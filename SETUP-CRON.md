# 设置 Pheromone Orchestrator 定时任务

## 方法 1: 使用 PowerShell 脚本（推荐）

### 步骤 1: 以管理员身份打开 PowerShell

1. 按 `Win + X`
2. 选择 **Windows PowerShell (管理员)** 或 **终端 (管理员)**

### 步骤 2: 运行设置脚本

```powershell
cd "C:\Users\panxinyu\.openclaw\workspace\agent-swarm"
.\setup-task.ps1
```

### 步骤 3: 验证任务

```powershell
# 查看任务状态
Get-ScheduledTask -TaskName "Pheromone-Orchestrator"

# 查看任务信息
Get-ScheduledTaskInfo -TaskName "Pheromone-Orchestrator"

# 手动触发测试
Start-ScheduledTask -TaskName "Pheromone-Orchestrator"
```

---

## 方法 2: 使用命令行（需要管理员）

### 以管理员身份运行 CMD 或 PowerShell:

```cmd
schtasks /Create /TN "Pheromone-Orchestrator" /TR "PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\panxinyu\.openclaw\workspace\agent-swarm\orchestrator.ps1'" /SC MINUTE /MO 10 /RU %USERNAME% /RL HIGHEST /F /IT
```

---

## 方法 3: 手动创建（图形界面）

### 步骤 1: 打开任务计划程序

1. 按 `Win + R`
2. 输入 `taskschd.msc`
3. 回车

### 步骤 2: 创建基本任务

1. 右侧点击 **创建基本任务**
2. 名称：`Pheromone-Orchestrator`
3. 描述：`每 10 分钟检查 Agent Swarm 进度`
4. 点击 **下一步**

### 步骤 3: 配置触发器

1. 触发器：**一次**
2. 开始时间：当前时间 + 2 分钟
3. 点击 **下一步**

### 步骤 4: 配置重复

1. 勾选 **重复任务间隔**: 选择 **每 10 分钟**
2. 持续时间：选择 **无限期**
3. 点击 **下一步**

### 步骤 5: 配置操作

1. 操作：**启动程序**
2. 程序/脚本：`PowerShell.exe`
3. 添加参数：`-NoProfile -ExecutionPolicy Bypass -File "C:\Users\panxinyu\.openclaw\workspace\agent-swarm\orchestrator.ps1"`
4. 起始于：`C:\Users\panxinyu\.openclaw\workspace\agent-swarm`
5. 点击 **下一步**

### 步骤 6: 完成配置

1. 勾选 **当点击完成时打开属性对话框**
2. 点击 **完成**

### 步骤 7: 配置高级选项

在属性对话框中：

1. 勾选 **使用最高权限运行**
2. 配置选项卡：
   - 勾选 **只有在计算机使用交流电源时才启动此任务**（如果是笔记本，取消勾选）
3. 条件选项卡：
   - 取消勾选 **只有在以下网络连接可用时才启动**
4. 点击 **确定**

---

## 验证任务是否运行

### 查看任务历史

1. 打开任务计划程序
2. 找到 `Pheromone-Orchestrator`
3. 点击 **历史记录** 选项卡
4. 查看最近运行记录

### 查看日志文件

```powershell
Get-Content "C:\Users\panxinyu\.openclaw\workspace\agent-swarm\orchestrator.log" -Tail 20
```

### 手动触发测试

```powershell
# 运行 Orchestrator 测试
$env:GITHUB_TOKEN="YOUR_GITHUB_TOKEN"  # Replace with your actual token
& "C:\Users\panxinyu\.openclaw\workspace\agent-swarm\orchestrator.ps1"
```

---

## 故障排除

### 任务不运行

1. 检查任务状态：
   ```powershell
   Get-ScheduledTask -TaskName "Pheromone-Orchestrator"
   ```

2. 查看任务最后运行结果：
   ```powershell
   Get-ScheduledTaskInfo -TaskName "Pheromone-Orchestrator" | Select-Object LastRunTime, LastTaskResult
   ```

3. 如果 `LastTaskResult` 不是 `0`，说明有错误

### 权限问题

- 确保以管理员身份运行 PowerShell
- 确保任务配置中勾选了 **使用最高权限运行**

### PowerShell 执行策略

如果看到执行策略错误：
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

---

## 预期行为

**设置成功后：**

- 首次运行：设置后 1-2 分钟
- 运行间隔：每 10 分钟
- 日志文件：`orchestrator.log` 每次运行都会追加记录
- GitHub Issues：每次运行都会检查

**日志示例：**
```
2026-02-28 20:43:29 - Orchestrator check completed
2026-02-28 20:53:29 - Orchestrator check completed
2026-02-28 21:03:29 - Orchestrator check completed
```

---

**设置完成后告诉我，我会验证是否正常运行！**