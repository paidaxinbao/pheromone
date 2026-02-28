# Setup Windows Task Scheduler for Pheromone Orchestrator

Write-Host "Setting up Windows Task Scheduler..." -ForegroundColor Cyan

# Create task action
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"C:\Users\panxinyu\.openclaw\workspace\agent-swarm\orchestrator.ps1`""

# Create trigger (every 10 minutes)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 10) `
    -RepetitionDuration ([TimeSpan]::MaxValue)

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

# Register task
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
    Write-Host ""
    Write-Host "To view task: Get-ScheduledTask -TaskName 'Pheromone-Orchestrator'" -ForegroundColor Yellow
    Write-Host "To run now: Start-ScheduledTask -TaskName 'Pheromone-Orchestrator'" -ForegroundColor Yellow
} catch {
    Write-Host ""
    Write-Host "Failed to create task: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run PowerShell as Administrator and try again" -ForegroundColor Yellow
}