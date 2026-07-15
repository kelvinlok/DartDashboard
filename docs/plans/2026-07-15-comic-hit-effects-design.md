# Comic Hit Effects Design

## Goal

Make meaningful dartboard hits feel more exciting while fixing clipped score numbers and keeping the app fully static and GitHub Pages compatible.

## Approved Experience

- Give the SVG dartboard a larger coordinate-space margin so all score numbers remain visible at every responsive size.
- Default player names are `Noob 1`, `Noob 2`, and so on.
- Dartboard clicks display a centered comic callout for `DOUBLE!`, `TRIPLE!`, `BULL!`, and `BULLSEYE!`.
- The callout uses heavy white lettering, a black offset outline, a hit-specific color shadow, a jagged impact burst, and halftone dots.
- The word slams in with a slight rotation and overshoot, shakes once, and clears after roughly 850ms.
- Existing board glows remain as a secondary hit response.
- Keyboard totals do not show bed-specific callouts because the exact hit type is unknown.
- The experience is visual only, with no sound effects.
- Reduced-motion users receive a brief fade instead of the slam and shake sequence.

## Implementation Shape

Add one pointer-transparent, screen-centered live-region overlay to the game view. A small pure helper maps dart areas to announcement labels and visual variants. Dartboard actions restart the overlay animation on each qualifying hit; normal singles and manual scores leave it hidden.

The SVG view box gains enough padding around its current 500 by 500 drawing space to contain labels centered just beyond the board face. CSS handles the impact burst and halftone treatment without external images or runtime dependencies.

## Testing

- Unit-test the hit-area-to-callout mapping before implementation.
- Unit-test the default player-name generator before implementation.
- Run the complete scoring suite after changes.
- Load the site through a local static server and inspect desktop and mobile screenshots for number clipping, overlay placement, and layout regressions.
