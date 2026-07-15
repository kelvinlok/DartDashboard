# Electronic Dartboard Audio Design

## Goal

Add a polished, responsive audio system to the 301 dart dashboard. The sound should evoke a premium electronic dartboard with energetic arcade-host callouts. Audio quality and consistency take priority over asset size.

## Creative Direction

Use a hybrid, pre-rendered sound pack. Each scoring sound combines a tactile dart impact with an electronic confirmation layer. Important events add brighter musical layers and, where appropriate, an energetic spoken callout.

Ordinary hits remain brief and non-verbal so repeated throws do not become tiring. Major events receive progressively stronger treatment:

- Single: compact impact and confirmation beep
- Double: impact with a brighter two-note accent
- Triple: impact with a sharper, more exciting three-note accent
- Outer bull: deeper impact and rising flourish
- Bullseye: premium impact, rising flourish, and “Bullseye!”
- Bust: error impact, descending sting, and “Bust!”
- Checkout: full celebratory fanfare and “Game shot!”
- Turn change: short handoff cue that does not compete with scoring sounds

## Architecture

Introduce a central `SoundManager` responsible for loading, mixing, and playing audio. Game and interface code sends it semantic event names rather than manipulating audio elements directly.

The event map covers `single`, `double`, `triple`, `outerBull`, `bullseye`, `bust`, `checkout`, and `turnChange`. The manager unlocks audio on the first user interaction to satisfy browser autoplay policies.

Add a mute control and volume control. Store both settings locally so they survive reloads. Missing assets, decoding failures, and unsupported audio APIs must leave gameplay fully functional and silent rather than surface errors to the player.

## Playback Behavior

Every registered dart starts its impact layer immediately. Special effects scale in intensity from double through checkout. Spoken callouts temporarily duck other playback so the voice remains clear.

Short impacts may overlap during rapid input, but long fanfares and voice callouts must not stack. A newer high-priority event replaces an older long event when necessary. Repeated playback must not clip, distort, or increase loudness unpredictably.

Undo remains silent. Other interface controls remain silent unless a subtle control cue proves useful during implementation testing.

## Asset Production

Create original, mastered source effects using layered synthesized tones, shaped noise and impact transients, musical accents, and processed energetic voice callouts. Keep lossless master files and provide browser-ready assets in formats supported by the target browsers.

Normalize perceived loudness across the set while retaining stronger apparent impact for major events. Leave sufficient headroom for overlapping transient layers and apply short fades to prevent clicks at asset boundaries.

## Data Flow

1. A player action updates the game state.
2. The resulting semantic game event is determined from the accepted state transition.
3. The UI renders the new state and sends the event name to `SoundManager`.
4. `SoundManager` applies mute, volume, priority, overlap, and ducking rules.
5. Playback starts or fails silently without affecting game logic.

Audio must only respond to accepted game actions. Rejected input and restored state must not accidentally replay scoring sounds.

## Testing

Automated tests will verify:

- Each scoring result maps to the intended sound event.
- Muting and volume changes persist.
- Audio unlock is attempted only in response to user interaction.
- Rapid impacts can overlap while voice and fanfare channels follow priority rules.
- Load and playback failures do not interrupt scoring.
- Undo and invalid actions do not trigger scoring sounds.

Manual browser checks will cover desktop and mobile playback timing, audible latency, loudness balance, clipping, speech clarity, autoplay restrictions, and fatigue during repeated throws.

## Success Criteria

The finished dashboard responds instantly to dart input, clearly distinguishes scoring events by sound, makes bullseye, bust, and checkout feel memorable, and stays pleasant during a full match. Audio preferences persist, and any audio failure leaves the game usable.
