# Setup Windows Task Scheduler for Pheromone Orchestrator (User Level)

Write-Host "Setting up Windows Task Scheduler (User Level)..." -ForegroundColor Cyan

# Create task action
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"C:\Users\panxinyu\.openclaw\workspace\agent-swarm\orchestrator.ps1`""

# Create trigger (every 10 minutes, starting 1 minute from now)
$startTime = (Get-Date).AddMinutes(1)
$trigger = New-ScheduledTaskTrigger -Once -At $startTime `
    -RepetitionInterval (New-TimeSpan -Minutes 10) `
    -RepetitionDuration (New-TimeSpan -Days 365)

# Create principal (run as current user)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME `
    -LogonType S4U `
    -RunLevel Limited

# Create settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Register task (user level, no admin required)
try {
    Register-ScheduledTask `
        -TaskName "Pheromone-Orchestrator" `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description "Check Pheromone Agent Swarm progress every 10 minutes" `
        -ErrorAction Stop
    
    Write-Host ""
    Write-Host "Task created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Name: Pheromone-Orchestrator" -ForegroundColor Cyan
    Write-Host "Run Interval: Every 10 minutes" -ForegroundColor Cyan
    Write-Host "First Run: 1 minute from now" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "Failed to create task: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Trying alternative method..." -ForegroundColor Yellow
    
    # Try with schtasks command
    $taskCmd = "schtasks /Create /TN `"Pheromone-Orchestrator`" /TR `"PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\panxinyu\.openclaw\workspace\agent-swarm\orchestrator.ps1'`" /SC MINUTE /MO 10 /RU `"$env:USERNAME`" /ST $(Get-Date -Format 'HH:mm') /F"
    Write-Host "Running: $taskCmd" -ForegroundColor Gray
    Invoke-Expression $taskCmd
}