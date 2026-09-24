#!/usr/bin/env pwsh
[CmdletBinding()]
param([Parameter(ValueFromRemainingArguments = $true)][string[]] $GitArguments)

$account = ([string](& git config --local --get codex.githubAccount)).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($account)) {
    Write-Error 'Set this repository local config: git config --local codex.githubAccount RichSims686'
    exit 1
}

$token = & gh auth token --hostname github.com --user $account
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
    Write-Error "Could not retrieve the GitHub CLI credential for account '$account'."
    exit 1
}

$askpassPath = Join-Path ([IO.Path]::GetTempPath()) ('codex-git-askpass-' + [guid]::NewGuid().ToString('N') + '.cmd')
$askpassContent = @(
    '@echo off'
    'set "prompt=%~1"'
    'echo %prompt% | findstr /i "Password" >nul'
    'if %errorlevel%==0 ('
    '  echo %GH_TOKEN%'
    ') else ('
    '  echo x-access-token'
    ')'
)
Set-Content -Path $askpassPath -Value $askpassContent -Encoding ascii

$previousAskpass = $env:GIT_ASKPASS
$previousTerminalPrompt = $env:GIT_TERMINAL_PROMPT
$previousToken = $env:GH_TOKEN
try {
    $env:GH_TOKEN = $token
    $env:GIT_ASKPASS = $askpassPath
    $env:GIT_TERMINAL_PROMPT = '0'
    & git push @GitArguments
    exit $LASTEXITCODE
}
finally {
    if ($null -eq $previousAskpass) { Remove-Item Env:GIT_ASKPASS -ErrorAction SilentlyContinue } else { $env:GIT_ASKPASS = $previousAskpass }
    if ($null -eq $previousTerminalPrompt) { Remove-Item Env:GIT_TERMINAL_PROMPT -ErrorAction SilentlyContinue } else { $env:GIT_TERMINAL_PROMPT = $previousTerminalPrompt }
    if ($null -eq $previousToken) { Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue } else { $env:GH_TOKEN = $previousToken }
    Remove-Item -LiteralPath $askpassPath -Force -ErrorAction SilentlyContinue
}

