# Dart Dashboard Design

## Goal

Create a self-contained static Dart Dashboard website for logging multiplayer 301 games on one device. The site must run directly from local files and be deployable to GitHub Pages without a server or database.

## Product Shape

The app starts with a setup screen where players add names, choose the 301 game, and select either straight-out or double-out rules. After starting, the main screen becomes the scoring workspace: current player, remaining score, current visit total, turn history, undo, and new game controls.

## Input

Players can score by clicking a dartboard or entering an integer from the keyboard.

- Dartboard clicks record exact hits, including singles, doubles, triples, outer bull, and bullseye.
- Keyboard/manual entry accepts any integer as a trusted override.
- Keyboard entry does not validate dart-by-dart legality.

## Scoring Rules

- Straight out: a player wins by reaching exactly 0.
- Double out: a player wins only when the final exact dartboard hit is a double or bullseye.
- For keyboard entry in double-out mode, exact 0 asks for confirmation that the finish was valid.
- Scores below 0 bust.
- In double-out mode, ending a turn on 1 also busts.
- Bust restores the player score to the start of that turn and advances to the next player.

## Visual Direction

The app should feel like an energetic arcade sports-bar dashboard: dark, high-contrast, kinetic, and practical. Animations emphasize meaningful events: double, triple, outer bull, bullseye, bust, checkout, and player turn changes.

## Architecture

Use plain HTML, CSS, and JavaScript with no build step and no external runtime dependency. Keep scoring logic in small pure functions so it can be tested outside the browser. Store active game state in `localStorage` for refresh recovery.

## Testing

Add a browser-free JavaScript test script for scoring behavior: valid scores, busts, straight-out wins, double-out wins, keyboard confirmation, turn advancement, and undo.
