# Pheromone Swarm Test - PowerShell Version
# Start 6 Agent processes with callback servers

Write-Host "🚀 Starting Pheromone Swarm Test (6 Agents)..." -ForegroundColor Cyan

$hubUrl = "http://localhost:18888"

# Register and start callback server for each agent
for ($i = 1; $i -le 6; $i++) {
  $agentId = "agent-$i"
  $role = "role-$i"
  $port = 9000 + $i
  
  Write-Host "Starting $agentId on port $port..." -NoNewline
  
  # Register with Hub
  $registerData = @{
    agent = @{
      id = $agentId
      role = $role
      callbackUrl = "http://localhost:$port/callback"
    }
  } | ConvertTo-Json -Depth 3
  
  try {
    $result = Invoke-RestMethod -Uri "$hubUrl/register" -Method POST -Body $registerData -ContentType "application/json" -ErrorAction Stop
    Write-Host " ✅ Registered" -ForegroundColor Green
  } catch {
    Write-Host " ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    continue
  }
  
  # Start callback server in background
  Start-Job -Name "agent-$i" -ArgumentList $agentId, $port -ScriptBlock {
    param($agentId, $port)
    
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/callback")
    $listener.Start()
    
    Write-Host "[$agentId] Callback server listening on port $port"
    
    while ($listener.IsListening) {
      $context = $listener.GetContext()
      $request = $context.Request
      $response = $context.Response
      
      if ($request.HttpMethod -eq 'POST') {
        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd()
        $reader.Close()
        
        try {
          $data = $body | ConvertTo-Json
          Write-Host "[$agentId] Received: $data" -ForegroundColor Yellow
        } catch {
          Write-Host "[$agentId] Received raw: $body" -ForegroundColor Yellow
        }
        
        $responseText = "OK"
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseText)
        $response.ContentLength64 = $buffer.Length
        $response.OutputStream.Write($buffer, 0, $buffer.Length)
        $response.OutputStream.Close()
      } else {
        $response.StatusCode = 404
        $response.OutputStream.Close()
      }
    }
    
    $listener.Stop()
  } | Out-Null
}

Write-Host "`n✅ All 6 agents started!" -ForegroundColor Green
Write-Host "Hub: http://localhost:18888/health" -ForegroundColor Cyan
Write-Host "Agents: http://localhost:18888/agents" -ForegroundColor Cyan
Write-Host "`nTo stop: Get-Job | Stop-Job; Get-Job | Remove-Job" -ForegroundColor Yellow
