# Pheromone Automation Setup
# Run this script ONCE as Administrator

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Pheromone Automation Setup               ║" -ForegroundColor Cyan
Write-Host "║   智能蜂群自动化设置                        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$scriptPath = "C:\Users\panxinyu\.openclaw\workspace\agent-swarm\phero-auto-trigger.ps1"
$taskName = "Pheromone-Auto-Trigger"

Write-Host "📋 配置信息:" -ForegroundColor Yellow
Write-Host "  脚本路径：$scriptPath"
Write-Host "  任务名称：$taskName"
Write-Host "  运行间隔：每 10 分钟"
Write-Host ""

# Create scheduled task action
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

# Create trigger (every 10 minutes)
$trigger = New-ScheduledTaskTrigger -Once `
    -At (Get-Date).AddMinutes(2) `
    -RepetitionInterval (New-TimeSpan -Minutes 10)

# Create principal (run as current user with highest privileges)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

# Create settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

Write-Host "⚙️  创建任务计划..." -ForegroundColor Yellow

try {
    # Register the task
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description "Pheromone project auto-trigger: checks task queue and triggers agents every 10 minutes" `
        -ErrorAction Stop
    
    Write-Host ""
    Write-Host "✅ 任务创建成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 任务信息:" -ForegroundColor Cyan
    Write-Host "  任务名称：$taskName"
    Write-Host "  运行间隔：每 10 分钟"
    Write-Host "  首次运行：2 分钟后"
    Write-Host ""
    Write-Host "🔧 管理命令:" -ForegroundColor Cyan
    Write-Host "  查看状态：Get-ScheduledTask -TaskName '$taskName'"
    Write-Host "  立即运行：Start-ScheduledTask -TaskName '$taskName'"
    Write-Host "  查看日志：Get-ScheduledTaskInfo -TaskName '$taskName'"
    Write-Host "  删除任务：Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
    Write-Host ""
    Write-Host "📝 日志文件：C:\openclaw-shared\auto-trigger.log" -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ 创建失败：$_" -ForegroundColor Red
    Write-Host ""
    Write-Host "请确认：" -ForegroundColor Yellow
    Write-Host "  1. 以管理员身份运行此脚本"
    Write-Host "  2. PowerShell 执行策略允许运行脚本"
    Write-Host ""
    exit 1
}