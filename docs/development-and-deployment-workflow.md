# Development and Deployment Workflow

This project uses a simple two-branch workflow designed for a solo developer.

## Branches

- `dev` is the daily development and testing branch.
- `main` is the stable production branch.

Feature branches are optional. For small changes, work directly on `dev` and make focused commits when practical. A commit does not need to be perfect; it should simply represent a reasonably understandable unit of work. After verifying and committing a focused `dev` change, push it to `origin/dev` unless the user explicitly asks not to, so the development deployment can pick it up promptly.

Production changes should be promoted from `dev` to `main` deliberately, preferably through a pull request so the release has a visible checkpoint.

## Development cycle

1. Make changes on `dev`.
2. Run local checks and tests.
3. Push `dev` to GitHub.
4. Test the development deployment.
5. When the change is ready, merge `dev` into `main`.
6. Verify the production deployment.

```text
work on dev
    -> test locally
    -> push dev
    -> test development deployment
    -> merge dev into main
    -> production deployment
```

## Local testing

Use the local machine for fast feedback:

```powershell
node --check src/app.js
node tests/schema-persistence.test.mjs
firebase serve --only hosting --port 5000
```

Local checks should cover syntax, unit behavior, imports, UI interactions, and obvious regressions.

Be aware that the current Firebase configuration points at the production Firebase backend. A local app can therefore read or write production Firestore data. A separate Firebase development project should be added before extensive multi-user testing.

## Development deployment

The `dev` branch should deploy to a development Hosting destination, such as a named Hosting preview channel or a separate development Hosting site. It should not replace the production live channel.

A preview-channel deployment can be made manually with:

```powershell
firebase hosting:channel:deploy dev
```

The current development preview is [https://bovine-scouting-analysis--dev-jwvpwxjf.web.app/](https://bovine-scouting-analysis--dev-jwvpwxjf.web.app/). This channel URL expires on September 1, 2026; update this document whenever Firebase issues a replacement URL.

The development deployment should display a visible `DEVELOPMENT` banner so it cannot be confused with the live site.

Preview deployments can still use the Firebase backend resources. A separate Firebase development project is the safer long-term setup.

## Production deployment

The `main` branch is the only branch that should deploy to the live site:

```text
https://bovine-scouting-analysis.web.app/
```

A manual production deployment is:

```powershell
firebase deploy --only hosting
```

Rules and backend functions are deployed separately when they change:

```powershell
firebase deploy --only firestore:rules
firebase deploy --only functions:sendMailOnCreate
```

## GitHub Actions

The intended automation is branch-based:

- A push to `dev` deploys the development version.
- A merge or push to `main` deploys production.
- Pull-request preview deployments are optional; they are not required for this solo-developer workflow.

GitHub stores the source and runs the deployment workflow. Firebase does not automatically deploy from GitHub unless a GitHub Action or Firebase continuous-deployment integration has been configured.

Until automation is configured, deployments are manual and publish the files from the currently checked-out branch. Always verify the branch before running a live deployment.

## Production safety

- Keep `main` protected from accidental direct pushes where practical.
- Use a pull request when promoting `dev` to `main`.
- Set Firebase and Google Cloud budget alerts.
- Check the deployed site after production releases.
- Keep SMTP passwords and other secrets out of Git.
- Prefer a separate Firebase development project before testing destructive or high-volume operations.

## Roles of the tools

- Local machine: edit, test, and run the app locally.
- Git: record changes and branches.
- GitHub: store the repository, review release changes, and run automation.
- Firebase Hosting: serve the web app.
- Firestore/Auth/Functions: provide shared data, login, and backend services.
- Codex: help edit code, run tests, and perform explicitly requested deployments.
## Current GitHub Actions configuration

The repository now contains these Hosting workflows:

- `.github/workflows/firebase-hosting-dev.yml` deploys pushes to `dev` to the `dev` preview channel for 30 days.
- `.github/workflows/firebase-hosting-merge.yml` deploys pushes to `main` to the live channel.
- `.github/workflows/firebase-hosting-pull-request.yml` creates optional PR preview deployments.
- `.github/workflows/validate.yml` runs syntax and regression checks on `dev`, `main`, and release pull requests.

The deployment workflows also run the same checks before publishing Hosting content.

The development banner is shown automatically when the app is running on localhost or a non-production Hosting hostname. Production hostnames are explicitly allowlisted in the app code.

Before relying on the workflows, verify that the Firebase-generated GitHub secret named `FIREBASE_SERVICE_ACCOUNT_BOVINE_SCOUTING_ANALYSIS` exists in the repository and that the Firebase project is authorized for the repository.
