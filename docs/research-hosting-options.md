# Research: beginner-friendly hosting for Scouting Analysis

## What the app needs today

This repository is a static browser application: `index.html` loads JavaScript
and CSS directly from `src/`, and there is no `package.json`, server process,
or database service. Its current roughly 10 MB of checked-in site files can be
served by a static host unchanged. In plain English, the host is a public
filing cabinet for the app's files; each visitor's browser runs the app.

The app currently uses browser `localStorage` and IndexedDB for much of its
saved state. Consequently, hosting it will **not** make picklists, accounts,
or scouting submissions shared among users: they remain on each person's
browser/device. It also means a The Blue Alliance API key entered in the
browser must be treated as visible to that user, not as a server secret.

## Recommendation: Cloudflare Pages Free

Use **Cloudflare Pages Free** for the first public deployment. It is a good
fit because it hosts static files, accepts private GitHub repositories, gives
the site a free `pages.dev` address, and can deploy automatically when a chosen
Git branch is pushed. No server administration, Linux, or database is needed.

Cloudflare's documentation says Pages supports GitHub/GitLab integration for
automatic deployments and private repositories; it also says a project does
not need a framework or build command. For this repository the deployment
settings should be:

| Setting | Value |
| --- | --- |
| Production branch | `dev` while that remains the shared development branch; move to `main` when a release branch is established. |
| Build command | Leave blank. |
| Build output directory | Repository root (`/`). |

The Free plan permits 500 builds per month, 20,000 uploaded files per site,
and 25 MiB per individual asset. Static-asset requests are free and unlimited.
The current project is comfortably within those file-size limits.

Official sources:

- [Cloudflare: Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare: Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare: Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)

## Other sensible first choices

**GitHub Pages** is the simplest alternative if making this repository public
is acceptable. It is included with GitHub Free for public repositories, but
GitHub says GitHub Free Pages is for public repositories. That makes it a poor
default here if source snapshots or scouting data should stay private. GitHub
also documents a 1 GB published-site limit and a soft 100 GB/month bandwidth
limit.

- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [GitHub plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)

## ELI5 deployment path

1. Put the app's source code in GitHub (already done).
2. Connect the GitHub repository to Cloudflare Pages once.
3. Cloudflare copies the files to its public computers and gives a URL such as
   `https://scouting-analysis.pages.dev`.
4. When a tested change is pushed to the production branch, Cloudflare repeats
   the copy automatically. This is a deployment.
5. Optionally buy a friendly domain name later and point it at Pages; the host
   supplies HTTPS automatically for the hosted address.

## Later: when a real server is needed

Stay on static hosting until people must see the same submissions, use real
accounts, or keep provider secrets out of browsers. Then add a small
server-side API plus database. Cloudflare Pages Functions/Workers are a natural
next step because they add server-side code without managing a virtual machine;
however, design authentication and shared data deliberately before collecting
any student/scouting data. Do not put private API keys or sensitive scouting
submissions in the public static files.

Cloudflare's Pages overview describes Pages Functions as server-side code and
links its serverless storage products; those would be evaluated at that later
stage, rather than paying for a traditional always-on server now.

- [Cloudflare Pages overview](https://developers.cloudflare.com/pages/)
