[CmdletBinding()]
param(
  [int]$Port = 4173,
  [string]$HostAddress = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $repoRoot ".localhost-server.$Port.pid"
$emulatorPidFile = Join-Path $repoRoot ".firebase-emulators.pid"
$pythonCommand = Get-Command python -ErrorAction Stop
$firebaseCommand = Get-Command firebase -ErrorAction Stop
$javaCommand = Get-Command java -ErrorAction SilentlyContinue
if (-not $javaCommand) {
  $bundledJava = Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Recurse -Filter java.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($bundledJava) {
    $env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $bundledJava.FullName)
    $env:Path = "$(Split-Path -Parent $bundledJava.FullName);$env:Path"
  } else {
    throw "Java is required for the Firebase Auth and Firestore emulators. Install a JDK or set JAVA_HOME before running this script."
  }
}

$serverProcess = $null
if (Test-Path -LiteralPath $pidFile) {
  $existingPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existingPid) {
    $existingProcess = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
    if ($existingProcess) {
      Write-Output "Localhost server already running for $repoRoot at http://$HostAddress`:$Port/index.html (PID $existingPid)."
      $serverProcess = $existingProcess
    }
  }
  if (-not $serverProcess) { Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue }
}

if (-not $serverProcess) {
  $serverProcess = Start-Process `
    -FilePath $pythonCommand.Source `
    -ArgumentList "-m", "http.server", "$Port", "--bind", $HostAddress `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden `
    -PassThru

  Set-Content -LiteralPath $pidFile -Value $serverProcess.Id
}

$emulatorProcess = $null
if (Test-Path -LiteralPath $emulatorPidFile) {
  $existingEmulatorPid = Get-Content -LiteralPath $emulatorPidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existingEmulatorPid) { $emulatorProcess = Get-Process -Id ([int]$existingEmulatorPid) -ErrorAction SilentlyContinue }
  if (-not $emulatorProcess) { Remove-Item -LiteralPath $emulatorPidFile -ErrorAction SilentlyContinue }
}

if (-not $emulatorProcess) {
  $emulatorProcess = Start-Process -FilePath $firebaseCommand.Source -ArgumentList "emulators:start", "--only", "auth,firestore", "--project", "bovine-scouting-analysis" -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath $emulatorPidFile -Value $emulatorProcess.Id
  $seeded = $false
  for ($attempt = 0; $attempt -lt 20 -and -not $seeded; $attempt++) {
    Start-Sleep -Milliseconds 500
    & node (Join-Path $repoRoot "scripts\seed-firebase-emulators.mjs") 2>$null
    $seeded = ($LASTEXITCODE -eq 0)
  }
  if (-not $seeded) { throw "Firebase emulators did not become ready. Localhost startup stopped before allowing app use." }
}
Write-Output "Localhost server ready for $repoRoot at http://$HostAddress`:$Port/index.html (PID $($serverProcess.Id))."
