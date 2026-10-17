# Research: Ticket #206 Alliance Captain Selection

## Scope and sources

This note translates the 2026 REBUILT Alliance Selection rules into a state model for distinguishing confirmed Alliance Leads from teams that may become Leads if selected Leads leave the pool. The controlling source is the official [2026 FIRST Robotics Competition Game Manual](https://firstfrc.blob.core.windows.net/frc2026/Manual/2026GameManual.pdf), section 10.6.1, printed pages 123–126 (PDF pages 122–125), version TU22. The user-provided [summary video](https://www.youtube.com/watch?v=xr69EMH4BZM) could not be fetched for review, so it is not used as evidence.

## What the manual establishes

- After qualification, the top 8 ranked teams are Alliance Leads, ordered as Alliances 1–8. If a team that would be a Lead is absent, all lower-ranked Leads are promoted one spot. (10.6.1, p. 123.)
- Leads choose other teams in two rounds: rank order in round 1, reverse rank order in round 2. Each invitee immediately accepts or declines. (10.6.1, p. 123.)
- A team that declines cannot be invited again, but orange-highlighted teams “(will become captain if not picked)” are not crossed out on decline because they can still become captains. A Lead that declines an invitation can still invite teams, but cannot be invited again. (T606, 10.6.1, p. 126.)
- A valid pick is a team that has not accepted or declined another invitation and is not a Lead that already incurred a pick-timer violation. (T605, 10.6.1, p. 125.)

## Derived state model

Track rankings separately from official board placement. The implementation can reliably observe teams placed on the board and the eight first-pick cells; it has no authoritative per-team accept/decline record. Do not infer a decline from a missing placement.

1. **Confirmed Leads:** use the first eight unplaced teams in current TBA Team Rank order. When one is officially placed elsewhere, the next unplaced ranked team moves into the confirmed group.
2. **Possible Leads:** after the confirmed group, highlight the next `max(0, 7 - completed_first_round_picks)` unplaced ranked teams. Count completion only from the eight first-pick cells; second-pick placements do not reduce this band.
3. **Board precedence:** a placed team keeps the existing gray, struck-through selection style, which overrides either captain highlight.

The Game Manual's decline rules remain relevant to an event operator, but no decline state is represented in the current app data. Accordingly, this derived UI state depends only on final rankings, official board placements, and first-pick progression; it does not guess whether an unplaced team accepted or declined an invitation.

This state distinction avoids treating every original top-eight team as permanently confirmed after it is placed elsewhere. The possible band advances with official placements and shrinks as first-round captain selections are completed. The app does not claim to reproduce FMS accept/decline tracking because that information is not present in its current state model.

## Citation

FIRST, *2026 FIRST Robotics Competition Game Manual*, version TU22, §10.6.1, printed pp. 123–126, especially T601, T605, and T606: [official PDF](https://firstfrc.blob.core.windows.net/frc2026/Manual/2026GameManual.pdf).
