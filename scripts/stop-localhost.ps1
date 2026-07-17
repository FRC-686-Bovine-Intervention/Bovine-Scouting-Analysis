$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $repoRoot ".localhost-server.pid"

if (-not (Test-Path -LiteralPath $pidFile)) {
  Write-Output "No localhost server PID file found."
  exit 0
}

$serverPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $serverPid) {
  Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
  Write-Output "Removed empty localhost server PID file."
  exit 0
}

$process = Get-Process -Id ([int]$serverPid) -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id ([int]$serverPid)
  Write-Output "Stopped localhost server PID $serverPid."
} else {
  Write-Output "No running localhost server found for PID $serverPid."
}

Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
