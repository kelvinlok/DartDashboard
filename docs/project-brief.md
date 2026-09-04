# Project Brief: Dart Dashboard

**Status:** For approval
**Prepared:** 28 July 2026

## 1. Background

Casual darts is played in homes, offices, and bars where the board is a physical board and the scoring is done in someone's head or on a scrap of paper. Mental arithmetic slows the game down, arguments over who scored what are common, and nobody remembers whose turn it is after a round of drinks.

Existing scoring apps solve this badly for this audience. They ask players to create accounts, they require every player to install something on their own phone, they bury casual 301 under leagues and statistics nobody wants, and several of them stop working without a network connection.

## 2. Opportunity

A single-purpose scorer for one shared device. One person holds the phone or props up a tablet, everyone throws, and the app handles the maths, the turn order, and the drama. Nothing to install, nothing to sign up for, works with no internet connection.

## 3. Objectives

1. Remove all mental arithmetic and turn-tracking from a casual 301 match.
2. Make the scoring device fast and unambiguous enough that it never slows the game down.
3. Make the match feel more fun than paper scoring, not merely more accurate.
4. Require no accounts, no installation, and no ongoing running costs.

## 4. Target users

Groups of two or more people playing 301 socially around one board, with mixed levels of darts knowledge. The person entering scores may not be the person throwing. Some players will know the finishing rules well; others will not.

## 5. Scope

### In scope

**Match setup** — Name the players, drag them into the throwing order you want, and pick the finishing rule: straight out (land exactly on zero) or double out (finish on a double or the bullseye). Two players minimum, no upper limit that matters in practice.

**Two ways to score** — Tap the dart's landing spot on an on-screen dartboard, or type the total for the whole visit if the group is playing loose and fast. A dedicated Miss button handles darts that score nothing. The app knows the difference between a scoring dart and a visit total, and handles both correctly.

**Rules enforced automatically** — Busts are detected and the player's score is restored to where they started the turn. Under double out, the app refuses an illegal finish and warns when a player has left themselves an impossible number. Where the app cannot know what actually happened, for example when a total was typed by hand, it asks rather than guesses.

**Full finishing order, not just a winner** — The match continues after the first player checks out. Everyone gets a placing, first through last, and finished players are skipped automatically. This matters: in social play, second place is contested harder than first.

**Undo** — A full round of throws can be walked back, so a mis-tap is a two-second fix rather than an argument.

**Match survives interruption** — If the device is locked, the browser is closed, or the page is accidentally refreshed, the match is exactly where it was on return. No warning, no data loss, no re-entry.

**Atmosphere** — A dark, high-contrast arcade look built for glancing at from across a room. Triples, bulls, busts, and checkouts each get their own visual and audio reaction. Between visits, a full-screen announcement names the incoming player so nobody has to ask whose turn it is. Sound can be muted or turned down, and that preference is remembered.

**Inclusive by design** — The full game is playable by keyboard as well as by touch, with screen-reader support throughout, and reduced-motion preferences respected for players sensitive to animation.

### Out of scope for this release

Other game formats (501, cricket, around the clock). Remote or networked play across multiple devices. Player accounts or logins. Long-term statistics, averages, or historical match records. Automatic detection of illegal individual darts when a total is typed by hand. Any server-side component.

## 6. Success criteria

- A group can go from opening the app to their first dart in under a minute, without instruction.
- No player ever needs to calculate a remaining score or a checkout.
- Scoring a dart never becomes the thing the group is waiting on.
- An accidental entry is recoverable without restarting the match.
- A locked or refreshed device never costs the group their match.
- A player who does not know the double-out rules cannot accidentally record an illegal win.
- The app works with the network switched off.

## 7. Constraints and assumptions

The product is a website with no back end. This is a deliberate constraint, not a limitation to be worked around later: it keeps hosting free, removes any handling of personal data, removes the privacy and security surface that comes with accounts, and means the app cannot break because a service went down.

We assume one device is shared and that the group is in the same room. We assume the person scoring is trusted by the group, so typed totals are accepted at face value rather than validated.

**Cost:** No licensing, hosting, or infrastructure spend. The only investment is delivery effort.

## 8. Risks

| Risk | Response |
| --- | --- |
| Mis-taps on a small screen frustrate players | Generous tap targets, immediate visual and audio confirmation of what was recorded, and one-round undo |
| Celebration effects become annoying rather than fun | Effects are short and tied only to meaningful events; sound is mutable and the setting persists |
| Typed totals let an illegal finish through | The app prompts for confirmation on any finish it cannot verify |
| Players lose track of turn order mid-match | Explicit full-screen handoff announcement between every visit |
| Losing a match to an accidental refresh damages trust in the app | Match state is preserved continuously, not on request |

## 9. Delivery approach

Incremental, in a fixed order, with each stage usable on its own:

1. **Core scoring** — setup, dartboard and manual entry, rules, turn rotation, undo, save and restore. Playable end to end.
2. **Match integrity** — full finishing order and placings, mis-entry handling, saved-match recovery.
3. **Atmosphere** — visual effects, sound pack, turn announcements, mute and volume controls.
4. **Polish** — mobile layout, keyboard and screen-reader support, reduced-motion handling, input ergonomics.

Each stage is designed and agreed in writing before it is built, and the scoring rules are covered by automated tests so later changes cannot quietly break the maths.

## 10. Decision requested

Approval to proceed on the scope in section 5, with the no-back-end constraint in section 7 accepted as a product decision rather than a temporary shortcut.
