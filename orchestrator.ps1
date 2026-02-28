# Pheromone Orchestrator - Simple Version
# Runs every 10 minutes to check Agent progress

Write-Host "=== Pheromone Orchestrator ===" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

# Check GitHub Issues for progress
$GitHubToken = $env:GITHUB_TOKEN  # Use environment variable
$Repo = "paidaxinbao/pheromone"

Write-Host "Checking GitHub Issues..." -ForegroundColor Yellow
try {
    $headers = @{ Authorization = "token $GitHubToken" }
    $issues = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/issues" -Headers $headers -Method Get
    
    Write-Host ""
    Write-Host "Issue Status:" -ForegroundColor Yellow
    foreach ($issue in $issues) {
        $icon = switch ($issue.state) {
            "open" { "[OPEN]" }
            "closed" { "[CLOSED]" }
        }
        Write-Host "  $icon #$($issue.number) $($issue.title)" -ForegroundColor White
    }
} catch {
    Write-Host "  Failed to check issues" -ForegroundColor Red
}

Write-Host ""
Write-Host "Next check: 10 minutes" -ForegroundColor Green
Write-Host ""

# Log to file
$logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Orchestrator check completed`n"
Add-Content -Path "C:\Users\panxinyu\.openclaw\workspace\agent-swarm\orchestrator.log" -Value $logEntry