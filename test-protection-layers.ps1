# Pheromone 保护层测试脚本

## 测试 1: 冷却期管理器 (Cooldown Manager)

**配置**: 10 秒冷却期
**测试**: agent-1 → agent-2 快速发送多条消息

```powershell
# 发送第 1 条消息（应该成功）
$msg1 = @{
  id = "msg-1"
  type = "message.direct"
  version = "1.1.0"
  timestamp = (Get-Date -Format "o")
  sender = @{ id = "agent-1"; role = "role-1" }
  recipient = @{ id = "agent-2" }
  payload = @{ content = "Test message 1" }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri http://localhost:18888/message -Method POST -Body $msg1 -ContentType "application/json"

# 立即发送第 2 条消息（应该被冷却期阻止）
$msg2 = @{
  id = "msg-2"
  type = "message.direct"
  version = "1.1.0"
  timestamp = (Get-Date -Format "o")
  sender = @{ id = "agent-1"; role = "role-1" }
  recipient = @{ id = "agent-2" }
  payload = @{ content = "Test message 2" }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri http://localhost:18888/message -Method POST -Body $msg2 -ContentType "application/json"
```

**预期结果**:
- 第 1 条：✅ 成功 (200)
- 第 2 条：⚠️ 被阻止 (429 Too Many Requests)

---

## 测试 2: 对话管理器 (Conversation Manager)

**配置**: 5 分钟 50 条消息
**测试**: 快速发送大量消息触发限制

```powershell
# 循环发送 55 条消息
for ($i = 1; $i -le 55; $i++) {
  $msg = @{
    id = "msg-$i"
    type = "message.direct"
    version = "1.1.0"
    timestamp = (Get-Date -Format "o")
    sender = @{ id = "agent-1"; role = "role-1" }
    recipient = @{ id = "agent-3" }
    payload = @{ content = "Message $i" }
  } | ConvertTo-Json -Depth 5
  
  try {
    $result = Invoke-RestMethod -Uri http://localhost:18888/message -Method POST -Body $msg -ContentType "application/json"
    Write-Host "Message $i : OK" -ForegroundColor Green
  } catch {
    Write-Host "Message $i : BLOCKED - $($_.Exception.Message)" -ForegroundColor Red
  }
}
```

**预期结果**:
- 前 50 条：✅ 成功
- 第 51-55 条：⚠️ 被阻止 (429)

---

## 测试 3: 查看保护层统计

```powershell
# 查看冷却期状态
Invoke-RestMethod -Uri http://localhost:18888/protection/stats | ConvertTo-Json -Depth 5

# 查看队列状态
Invoke-RestMethod -Uri http://localhost:18888/queues | ConvertTo-Json -Depth 5
```
