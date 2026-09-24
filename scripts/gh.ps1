#!/usr/bin/env pwsh
<#
.SYNOPSIS
Runs GitHub CLI using this repository's configured account without changing
GitHub CLI's machine-wide active account.
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

$env:GH_TOKEN = $token
try {
    & gh @GhArguments
    exit $LASTEXITCODE
}
finally {
    Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
}

