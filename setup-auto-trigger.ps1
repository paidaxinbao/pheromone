# Pheromone Auto-Trigger Setup
# Run this script ONCE as Administrator to enable automatic task triggering

Write-Host "=== Pheromone Auto-Trigger Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will set up automatic task triggering every 10 minutes." -ForegroundColor Yellow
Write-Host ""

# Create scheduled task
$taskAction = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"C:\openclaw-shared\tasks\auto-trigger.ps1`""
$taskTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 10)
$taskPrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
    Register-ScheduledTask -TaskName "Pheromone-Auto-Trigger" -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings -Description "Auto-trigger Pheromone tasks every 10 minutes" -ErrorAction Stop
    
    Write-Host "✅ Task created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Name: Pheromone-Auto-Trigger" -ForegroundColor Cyan
    Write-Host "Run Interval: Every 10 minutes" -ForegroundColor Cyan
    Write-Host "First Run: 2 minutes from now" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To view: Get-ScheduledTask -TaskName 'Pheromone-Auto-Trigger'" -ForegroundColor Yellow
    Write-Host "To run now: Start-ScheduledTask -TaskName 'Pheromone-Auto-Trigger'" -ForegroundColor Yellow
    Write-Host ""
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run this script as Administrator" -ForegroundColor Yellow
}