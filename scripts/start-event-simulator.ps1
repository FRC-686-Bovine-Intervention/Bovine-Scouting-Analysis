param(
  [int]$SimulatorPort = 8787,
  [int]$AppPort = 4174,
  [ValidateSet('simulator-first','fallback')][string]$RoutingMode = 'simulator-first',
  [double]$DelayScale = 0.01,
  [switch]$OpenBrowser
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path ([System.IO.Path]::GetTempPath()) ("event-simulator-" + [guid]::NewGuid().ToString('N') + '.json')
$previousStatePath = $env:EVENT_SIMULATOR_STATE
$env:EVENT_SIMULATOR_STATE = $statePath
$sim = Start-Process node -ArgumentList @('eventSimulator/server.mjs', $SimulatorPort) -WorkingDirectory $root -PassThru -WindowStyle Hidden
$configPath = Join-Path $root 'runtime-config.local.js'
$config = "globalThis.__EVENT_SIMULATOR_CONFIG = Object.freeze({mode:'$RoutingMode',tbaUrl:'http://127.0.0.1:$SimulatorPort/api/tba',statboticsUrl:'http://127.0.0.1:$SimulatorPort/api/statbotics',scoutingUrl:'http://127.0.0.1:$SimulatorPort/api/scouting/2026evsim',delayScale:$DelayScale});"
$config | Set-Content -LiteralPath $configPath -Encoding utf8
try {
  $ready = $false
  1..30 | ForEach-Object { if (-not $ready) { try { $ready = (Invoke-WebRequest "http://127.0.0.1:$SimulatorPort/state" -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200 } catch {} ; if (-not $ready) { Start-Sleep -Milliseconds 200 } } }
  if (-not $ready) { throw 'eventSimulator health check failed.' }
  $timing = @{ cursor = -1; increment = 1; delayScale = $DelayScale; offsets = @{ tba = 0; statbotics = 0; scouting = 0 }; latencyMs = @{ tba = 0; statbotics = 0; scouting = 0 } } | ConvertTo-Json -Depth 4
  Invoke-RestMethod "http://127.0.0.1:$SimulatorPort/control/set" -Method Post -ContentType 'application/json' -Body $timing | Out-Null
  $server = Start-Process powershell -ArgumentList @('-NoProfile','-Command',"Set-Location '$root'; python -m http.server $AppPort") -PassThru -WindowStyle Hidden
  Write-Output "eventSimulator: http://127.0.0.1:$SimulatorPort/"
  Write-Output "analysis app: http://127.0.0.1:$AppPort/"
  Write-Output "state file: $statePath"
  if ($OpenBrowser) { Start-Process "http://127.0.0.1:$AppPort/" }
  Wait-Process -Id $sim.Id
} finally {
  if ($server) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
  if ($sim) { Stop-Process -Id $sim.Id -Force -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  if ($null -eq $previousStatePath) { Remove-Item Env:EVENT_SIMULATOR_STATE -ErrorAction SilentlyContinue } else { $env:EVENT_SIMULATOR_STATE = $previousStatePath }
}
