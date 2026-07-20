$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $repoRoot ".localhost-server.pid"
$port = 4173
$hostAddress = "127.0.0.1"
$pythonCommand = Get-Command python -ErrorAction Stop

if (Test-Path -LiteralPath $pidFile) {
  $existingPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existingPid) {
    $existingProcess = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
    if ($existingProcess) {
      Write-Output "Localhost server already running at http://$hostAddress`:$port/index.html (PID $existingPid)."
      exit 0
    }
  }
  Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
}

$process = Start-Process `
  -FilePath $pythonCommand.Source `
  -ArgumentList "-m", "http.server", "$port", "--bind", $hostAddress `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -PassThru

Set-Content -LiteralPath $pidFile -Value $process.Id
Write-Output "Started localhost server at http://$hostAddress`:$port/index.html (PID $($process.Id))."
