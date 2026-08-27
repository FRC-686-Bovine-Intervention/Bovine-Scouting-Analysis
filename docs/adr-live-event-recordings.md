# ADR: Local Complete-State Recordings For Live Events

## Status

Accepted

## Context

The event simulator needs to replay real provider changes observed during a live event, including pre-event data, schedule release, results, corrections, outages, and provider fallback. Browser refresh state and the existing active raw-source cache are not an ordered event timeline.

## Decisions

- The recorder runs as a local Node process and accepts one or more event codes.
- Each event is stored independently under `recordings/<event-code>/`.
- The first successful observation is cursor 0 and represents the pre-event state when recording starts before competition.
- A cursor is a paired event revision containing complete TBA and Statbotics state, even when only one provider changed.
- Unchanged polling cycles do not create cursors.
- Provider timestamps, availability, effective URL, and fallback provenance are preserved with each cursor.
- Recorded bundles are the source for a distinct simulator playback mode; the existing synthetic scenario remains available.
- Scouting remains an independent simulator source in the first version.

## Consequences

Complete cursors are larger than deltas, but every cursor is independently inspectable, copyable, and replayable. Local storage avoids adding live-event write volume and authentication coupling to Firestore. The recorder must be running on the operator’s machine, and sharing a recording requires an explicit copy or export.
