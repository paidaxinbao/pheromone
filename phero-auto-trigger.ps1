# Pheromone Auto-Trigger Script
# Automatically checks task queue and triggers agents every 10 minutes

$TasksPath = "C:\openclaw-shared\tasks"
$StatusPath = "C:\openclaw-shared\status"
$LogPath = "C:\openclaw-shared\auto-trigger.log"
$FeishuId = "ou_c432107a74270c65fb18001bd00037d1"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "[$timestamp] $Message" | Out-File -FilePath $LogPath -Append
}

Write-Log "=== Pheromone Auto-Trigger Started ==="

# Check for pending tasks
$pendingTasks = Get-ChildItem "$TasksPath\pending" -Recurse -Filter "*.json" -ErrorAction SilentlyContinue

if ($pendingTasks.Count -eq 0) {
    Write-Log "No pending tasks"
    exit 0
}

Write-Log "Found $($pendingTasks.Count) pending task(s)"

# Process each pending task
foreach ($taskFile in $pendingTasks) {
    try {
        $task = Get-Content $taskFile.FullName | ConvertFrom-Json
        Write-Log "Triggering: $($task.id) -> $($task.assigned_to)"
        
        # Trigger agent via CLI
        $msg = "开始执行 $($task.id): $($task.title)"
        Write-Log "Running: openclaw agent --to $FeishuId -m `"$msg`" --thinking high"
        
        $cliOutput = openclaw agent --to $FeishuId -m $msg --thinking high --timeout 300 2>&1
        Write-Log "CLI Output: $cliOutput"
        
        # Move to in-progress
        $task.status = "in-progress"
        $task.started_at = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $task | ConvertTo-Json | Out-File -FilePath "$TasksPath\in-progress\$($taskFile.Name)" -Encoding UTF8
        Remove-Item $taskFile.FullName
        
        # Update status file
        $statusContent = @"
# $($task.assigned_to) Status

**Status**: WORKING
**Current Task**: $($task.id) - $($task.title)
**Started**: $($task.started_at)
**Auto-Triggered**: Yes

## Progress Log
| Time | Task | Status | Notes |
|------|------|--------|-------|
| $($task.started_at) | $($task.id) | In Progress | Auto-triggered |
"@
        $statusContent | Out-File -FilePath "$StatusPath\$($task.assigned_to).status.md" -Encoding UTF8
        
        Write-Log "Task $($task.id) triggered successfully"
        
    } catch {
        Write-Log "ERROR processing $($taskFile.Name): $_"
    }
}

Write-Log "=== Pheromone Auto-Trigger Completed ==="