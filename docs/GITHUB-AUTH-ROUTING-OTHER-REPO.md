# GitHub account routing setup for the Bovine Scouting repository

Use this instruction in the `FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis` repository. It is separate from the Risk-Based Guardrails repository and uses the `RichSims686` GitHub account. Do not change GitHub CLI's machine-wide active account to route commands; other Codex tasks may be running at the same time.

## Git operations

The local `origin` remote should identify the intended account in its HTTPS URL so Windows Git Credential Manager can keep the two accounts distinct:

```powershell
git remote set-url origin https://RichSims686@github.com/FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis.git
git remote -v
```

The username is an account selector, not a password or token. Git Credential Manager (GCM) should prompt for or reuse the credential belonging to `RichSims686`; do not put a token in the remote URL. Git pushes use GCM, separately from GitHub CLI authentication. Prefer ordinary `git push` when GCM can authenticate interactively or from its cache.

## GitHub CLI operations

Copy the latest tracked `scripts/gh.ps1` wrapper from the Risk-Based Guardrails repository into this repository (preserving its contents; replace any earlier copy so it includes `--git-push` fallback support), then set the account mapping locally:

```powershell
git config --local codex.githubAccount RichSims686
```

Use the wrapper for all GitHub CLI operations in this repository:

```powershell
pwsh -NoProfile -File scripts/gh.ps1 issue view 1 --repo FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis
```

The wrapper retrieves the token for the configured account from GitHub CLI's secure credential store and sets `GH_TOKEN` only for that `gh` process. It does not switch the global active account, so independent tasks can use their own account concurrently. Never store the token in the repo, print it, pass it as a command-line argument, or commit it.

If a Git push needs a password prompt that the agent shell cannot display, use the wrapper's explicit fallback:

```powershell
pwsh -NoProfile -File scripts/gh.ps1 --git-push origin your-branch-name
```

This retrieves the configured account token through the wrapper, disables credential helpers for only this push, and passes the token through a process-scoped environment variable to a temporary askpass helper. The helper contains no token and is removed after the operation. This fallback accepts only a username-qualified HTTPS `github.com` `origin` matching `codex.githubAccount`. Do not put the token in a remote URL, command-line argument, persistent environment setting, Git config, or file. If it fails, report the exact error rather than printing the token or switching the machine-wide active account.

Add an `AGENTS.md` instruction telling future agents in this repository to use `pwsh -NoProfile -File scripts/gh.ps1 ...` for GitHub CLI operations, use ordinary `git push` through GCM when possible, use the `--git-push` fallback only when needed, and not to call `gh auth switch`. Verify the mapping without revealing credentials:

```powershell
pwsh -NoProfile -File scripts/gh.ps1 api user --jq .login
```

Expected output is `RichSims686`. If it fails, check `gh auth status` and authenticate the intended account; do not switch accounts as a workaround while another task may be active.
