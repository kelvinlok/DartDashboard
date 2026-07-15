# Live Score And Finishing Order Design

## Goal

Show the true remaining score after every dart and allow every player to complete the 301 game after the first checkout.

## Live Remaining Score

During a dartboard visit, the active player's displayed remaining score is derived from the turn-start score minus the current visit total. The large Remaining readout and the active scoreboard row both use this live value. The committed player score remains unchanged until the visit ends so bust and undo behavior stay reliable.

When a visit busts, the turn-start score is restored and the display moves to the next unfinished player. Keyboard totals continue to complete a whole visit immediately.

## Per-Player Checkout

Checkout finishes one player rather than the entire match. A finished player remains at zero, receives the next finishing position, and is skipped by turn rotation. Play continues until every player checks out, including requiring the final unfinished player to complete a valid finish.

The game stores finish order as player indexes. A player's place is derived from that list. The first finisher remains the match winner, but controls stay enabled while any player is unfinished. Once all players finish, the match status becomes complete and scoring controls are disabled.

## Interface

- The current-player heading switches to the next unfinished player after a checkout.
- A checkout banner reports the player and finishing position.
- Finished scoreboard rows show `1st`, `2nd`, and so on instead of a remaining score.
- The final state presents the complete ordered standings.
- Existing checkout board and comic feedback remains unchanged.

## Undo And Persistence

Finish order is part of the existing snapshots, so Undo restores a checkout, the active player, and all scores atomically. New games initialize an empty finish order. Older saved games with the previous `won` status remain readable as completed games rather than being silently resumed under new rules.

## Testing

- Verify live remaining score derivation after one and two darts.
- Verify a checkout records first place and advances to an unfinished player while the match remains active.
- Verify finished players are skipped.
- Verify the final player must check out and completing all players ends the match.
- Verify Undo restores finish order and turn state.
- Re-run all straight-out, double-out, bust, manual-entry, and browser rendering checks.
