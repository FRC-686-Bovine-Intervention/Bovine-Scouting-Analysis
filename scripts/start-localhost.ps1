[CmdletBinding()]
param(
  [int]$Port = 4173,
  [string]$HostAddress = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $repoRoot ".localhost-server.$Port.pid"
$pythonCommand = Get-Command python -ErrorAction Stop

if (Test-Path -LiteralPath $pidFile) {
  $existingPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existingPid) {
    $existingProcess = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
    if ($existingProcess) {
      Write-Output "Localhost server already running for $repoRoot at http://$HostAddress`:$Port/index.html (PID $existingPid)."
      exit 0
    }
  }
  Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
}

$process = Start-Process `
  -FilePath $pythonCommand.Source `
  -ArgumentList "-m", "http.server", "$Port", "--bind", $HostAddress `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -PassThru

Set-Content -LiteralPath $pidFile -Value $process.Id
Write-Output "Started localhost server for $repoRoot at http://$HostAddress`:$Port/index.html (PID $($process.Id))."
