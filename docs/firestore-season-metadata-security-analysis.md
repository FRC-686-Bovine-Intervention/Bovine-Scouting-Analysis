# Firestore season metadata security analysis

## Scope and data model

This analysis covers the existing Standard Firestore database
`(default)` in `bovine-scouting-analysis` and the season metadata added by
issue #76.

* `users/{uid}`: Firestore-managed role documents; the authenticated owner or
  an administrator reads, while administrators write.
* `allowlist/{email}`: role documents keyed by the authenticated user's email;
  the owner or an administrator reads, while administrators write.
* `appState/activeEvent`: `{ eventKey, updatedAt }`; allowed members read and
  administrators create or update.
* `appState/configuration`: provider credentials. Existing `tbaAuthKey` and
  new `frcApiUsername` / `frcApiAuthorizationKey` are secrets. Only
  administrators may read or write this document.
* `seasonMetadata/{season}`: non-secret official title cache
  issue. Allowed members may read; only administrators may create or update.
  Fields are `{ season, gameName, source, fetchedAt }`; the UI title-cases the raw game name.
* `events/{eventId}/profiles/{profileId}` and
  `events/{eventId}/submissions/{submissionId}`: allowed members read;
  administrators write.
* `mail/{mailId}`: administrators create only.

## Client access patterns and queries

The browser uses direct document reads/writes for `appState/configuration`,
`appState/activeEvent`, event profiles, submissions, allowlist entries, and
the proposed `seasonMetadata/{season}` document. No `where`, `orderBy`, or
`limit` query is needed for this issue. Existing collection reads are used for
allowlist, profiles, and submissions; their current allowed-member read rules
remain unchanged.

## Authentication and authorization

Firebase Authentication supplies the user identity. The rules determine roles
from a server-managed `users/{uid}` document or allowlist record. The new
season cache deliberately contains no credentials and is readable only by
authenticated allowed users. Credentials remain in the existing admin-only
configuration document; a cached game title is never co-located with them.

## Validation constraints for this issue

Configuration accepts only the known optional credential strings and a server
timestamp, with bounded strings on both create and update. Season metadata
uses a numeric season range, bounded title/source strings, fixed source value,
and a timestamp. No user-controlled ownership or role fields are introduced.

## Devil's advocate review

* Public list exploit: denied because every season-metadata read requires an
  allowed authenticated user.
* Unauthorized credential read/write: denied because the configuration match
  requires an administrator for all reads and writes.
* Update bypass, schema pollution, and resource exhaustion: denied on both
  create and update by the same strict validators, allowed-key lists, types,
  and string-size limits.
* Credential mixed-content leak: avoided by keeping the public game-title cache
  in `seasonMetadata`, never in `appState/configuration`.
* Member cache modification or deletion: denied; the cache has only explicit
  administrator create/update rules and no delete rule.
* Credential clearing: allowed only to an administrator and still requires the
  bounded credential fields plus a server timestamp to satisfy the validator.

The rules compile successfully through Firebase's Firestore rules dry run.
