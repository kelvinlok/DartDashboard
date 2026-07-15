# Mobile Focus And Turn Handoff Design

## Goal

Make mobile scoring center on the current score and dartboard, while giving every completed visit a readable one-second handoff before the next player appears.

## Mobile Layout

At widths up to 680px, the game becomes a compact scoring surface rather than a stack of desktop panels.

- The header uses smaller current-player type with compact Undo and New controls.
- Remaining score, visit total, dart count, and current dart chips form a short match strip.
- The dartboard follows immediately and uses nearly the full viewport width.
- Keyboard entry sits directly below the board.
- Standings and turn history remain available below the primary scoring area.

Desktop and tablet layouts retain their current structure.

## Turn Handoff

Every completed visit creates a transient display snapshot containing the completed player's name, resulting score, visit total, darts, and result. The completed game state is saved immediately, while the renderer uses this snapshot for one second before revealing the next player.

During the handoff:

- scoring controls are locked;
- the completed player's resulting score and attempt remain visible;
- the current standings remain accurate;
- Undo is temporarily disabled;
- the next-player score pulse occurs when the handoff ends.

This applies consistently to three-dart visits, keyboard totals, busts, and checkouts. The final checkout holds the finishing attempt before showing Match complete.

## Bust Effect

A bust triggers `BUSTED!` in the same full-screen comic system as doubles and triples. It uses red and amber, a jagged impact burst, halftone texture, and the existing short slam animation. The restored turn-start score remains visible underneath for the full handoff. Reduced-motion mode keeps the one-second information hold but replaces the slam with a fade.

## State And Persistence

The one-second handoff is UI-only state and is not persisted. The resulting game is persisted before the delay begins, so refreshing or closing during the handoff cannot lose the completed visit. A pure helper derives the handoff snapshot by comparing history length before and after an action.

## Testing

- Verify no handoff is produced for the first or second dart of a visit.
- Verify three darts, keyboard totals, busts, and checkouts produce the correct snapshot.
- Verify `BUSTED!` maps into the comic callout system.
- Browser-test that score and attempt remain on screen for one second, controls lock, and the next player appears afterward.
- Verify the compact mobile layout at 390px and ensure the board, score, player, and visit status fit without overlap.
