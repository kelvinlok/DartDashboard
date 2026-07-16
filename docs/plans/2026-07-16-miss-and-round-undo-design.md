# Miss Entry and One-Round Undo Design

## Goal

Let players record an individual missed dart while expanding Undo to retain one complete round of score-entry actions: three actions per player.

## Miss Entry

Add a dedicated `Miss · 0` button directly below the dartboard. A miss enters the existing dartboard scoring path as `{ area: "miss", value: 0 }`, consumes one of the current player's three darts, and leaves the visit total and remaining score unchanged.

The current-visit display labels the dart as `MISS`. A miss produces no scoring sound, board flash, or comic callout. It follows the same handoff lock, persistence, and Undo behavior as any other dart. The button is disabled whenever board input is unavailable, including a turn handoff or completed match.

Clicking the empty area outside the dartboard does not record a miss. This avoids accidental zero-point darts, especially on touch screens, and preserves explicit keyboard access.

## Undo History

Retain a rolling window of `players.length * 3` pre-action snapshots. Two players therefore retain six actions, three retain nine, and so on. Dartboard hits and misses each consume one slot. A keyboard total consumes one slot because it represents a whole visit entered as a single action.

Continue using complete game-state snapshots because they reliably restore in-progress darts, player rotation, busts, checkouts, finish order, match completion, and history. Keep the snapshot array flat: every stored snapshot has an empty `snapshots` array. Before adding a snapshot, preserve the existing flat history, append the new pre-action state, and discard the oldest entries beyond the calculated limit.

Undo removes the newest snapshot and restores it with the remaining older snapshots attached. This permits repeated Undo calls until the one-round window is exhausted. The capacity remains based on the game's full player count, including players who have checked out.

## Saved-Game Compatibility and Performance

Normalize saved snapshot arrays to the current `players.length * 3` limit and clear nested snapshot histories. Existing one-step saves remain valid and can accumulate the expanded history from their next score entry. Older oversized or nested histories are flattened and trimmed during loading.

The history is bounded rather than unlimited, preventing the quadratic growth that previously caused click latency in long matches. Because the limit grows only with player count, storage and clone work remain predictable for the duration of a match.

## Error Handling and Accessibility

The miss button uses a native button with a clear accessible label and shares the scoring controls' disabled state. Invalid or locked actions remain no-ops through the existing UI guards. The scoring layer continues to reject actions after match completion.

Undo remains unavailable when no snapshots exist and during the visual handoff lock. Once the handoff completes, Undo may cross player boundaries and restore the previous player and partial visit exactly.

## Verification

Automated tests will cover:

- A miss scoring zero while consuming one dart.
- Three misses completing a visit and handing off to the next player.
- `MISS` presentation and absence of a miss sound event.
- Undo capacities of six actions for two players and nine for three players.
- Repeated Undo through the entire retained window and eviction of the oldest action.
- One undo slot for each keyboard total.
- Restoration across player handoffs, busts, checkouts, finish order, and match completion.
- Normalization of one-step, oversized, and nested legacy snapshot arrays.
- Full-suite syntax, scoring, audio, and stylesheet regression checks.

Responsive browser verification will confirm that the miss button is easy to reach below the board on desktop and mobile, does not reduce the board's usable size, and cannot be triggered by tapping empty board-stage space.
