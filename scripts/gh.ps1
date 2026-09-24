#!/usr/bin/env pwsh
<#
.SYNOPSIS
Runs GitHub CLI using this repository's configured account without changing
GitHub CLI's machine-wide active account. Use --git-push as the noninteractive
Git push fallback when ordinary Git Credential Manager authentication cannot prompt.
#>
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $GhArguments
)

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

if ($GhArguments.Count -gt 0 -and $GhArguments[0] -eq '--git-push') {
    $pushArguments = @($GhArguments | Select-Object -Skip 1)
    if ($pushArguments.Count -eq 0) {
        Write-Error 'Usage: scripts/gh.ps1 --git-push origin branch-name'
        exit 2
    }

    $origin = [string](& git remote get-url origin)
    if ($LASTEXITCODE -ne 0) {
        Write-Error 'Could not read the origin remote URL.'
        exit 1
    }
    $expectedOrigin = '^https://' + [regex]::Escape($account) + '@github\.com/[^/?#]+/[^/?#]+(?:\.git)?$'
    if ($origin -notmatch $expectedOrigin) {
        Write-Error "The --git-push fallback requires origin to be a username-qualified HTTPS github.com URL for '$account'."
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
        & git -c credential.helper= push @pushArguments
        exit $LASTEXITCODE
    }
    finally {
        if ($null -eq $previousAskpass) { Remove-Item Env:GIT_ASKPASS -ErrorAction SilentlyContinue } else { $env:GIT_ASKPASS = $previousAskpass }
        if ($null -eq $previousTerminalPrompt) { Remove-Item Env:GIT_TERMINAL_PROMPT -ErrorAction SilentlyContinue } else { $env:GIT_TERMINAL_PROMPT = $previousTerminalPrompt }
        if ($null -eq $previousToken) { Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue } else { $env:GH_TOKEN = $previousToken }
        Remove-Item -LiteralPath $askpassPath -Force -ErrorAction SilentlyContinue
    }
}

$env:GH_TOKEN = $token
try {
    & gh @GhArguments
    exit $LASTEXITCODE
}
finally {
    Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
}
