# Dartboard Click Latency Design

## Goal

Keep dartboard input responsive throughout a long 301 match while retaining one-step undo, comic hit effects, local-only persistence, and the one-second player handoff.

## Root Cause

Each score entry currently appends a full game snapshot to an unlimited undo array. Those snapshots each contain an increasingly long match history, so the saved game grows quadratically. A measured 210-dart match produced a 2.1 MB save and increased a single-hit handler from 1-3 ms to 24-26 ms.

Every hit also forces a synchronous dartboard layout restart. That restart is useful for animated double, triple, bull, bust, and checkout effects, but it runs unnecessarily for ordinary singles that have no board-flash animation.

The busy cursor after dart three is an explicit handoff style rather than evidence of processing. It makes the intentional one-second score hold feel like application lag.

## Design

Keep only the latest pre-entry snapshot in `game.snapshots`. A new dart or keyboard total replaces the previous snapshot, so Undo restores exactly the latest entry and cannot continue farther back. Existing saves are normalized to retain only their newest snapshot.

Restrict dartboard animation restarts to effect types that have corresponding CSS animations. A single hit still updates the score immediately but does not force a board reflow.

Keep the one-second handoff and input lock after a completed visit, but use the normal cursor instead of a wait cursor. Comic callouts and special-hit board flashes remain unchanged.

## Verification

Add scoring tests proving snapshots never exceed one entry, Undo works once only, and legacy saves collapse to one undo snapshot. Add a test for the animated board-effect allowlist. Run the full scoring suite, syntax checks, a browser latency benchmark using a long game, and desktop/mobile layout smoke checks.
