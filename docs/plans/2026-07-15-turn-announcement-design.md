# Incoming Turn Announcement Design

## Goal

Use the handoff pause to clearly and dramatically announce the incoming player without obscuring double, triple, bull, checkout, or bust effects.

## Visual Thesis

Arcade scoreboard meets an inked American comic panel: a cyan-and-amber impact burst, heavy outlined lettering, and a quick collision of two text layers over the full game surface.

## Content Plan

The announcement contains only the incoming player's uppercase name and the possessive label `'S TURN!`. Names ending in `s` use `' TURN!`. Long names may wrap and use a smaller presentation so they remain fully visible on desktop and mobile.

## Interaction Thesis

The impact burst snaps outward with overshoot. The player name enters from the left while the turn label enters from the right; they collide with a short shake, hold, then scale toward the viewer and fade. Movement uses transforms and opacity to avoid layout work during animation.

Ordinary completed visits show the announcement immediately within the existing one-second handoff. If the final dart triggers a comic callout, that 900 ms effect finishes first, then the incoming announcement plays for 900 ms. Special handoffs therefore last 1.8 seconds. Input remains locked through the full sequence.

Reduced-motion users receive a simple fade. The overlay is visual-only so the existing current-player status remains the single accessibility announcement when the handoff completes.

## Architecture

Pure helpers format the announcement and select adaptive timing from the effect area. The UI receives an incoming player name only when the match remains active. A dedicated fixed overlay is independent of the existing hit-callout overlay, allowing deterministic sequencing and mobile-safe sizing.

## Verification

Unit tests cover name formatting and normal/special timing. Browser tests verify immediate ordinary announcements, delayed special announcements, input lock duration, comic effect preservation, mobile bounds, and reduced-motion behavior.
