# Docs Notes

Repo documentation in this folder should stay durable and project-relevant.

Handoff files should not be stored in `docs/`.
Use the handoff skill's intended flow instead: write handoff artifacts to the OS temporary directory so they can carry session context without becoming stale repo guidance.

If you need to resume the latest handoff, check the OS temp directory for the most recent handoff file rather than relying on older repo-local notes.
