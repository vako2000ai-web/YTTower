# YTTower

YTTower is an autonomous browser game for a YouTube stream. A cartoon jumper falls through a rotating tower, breaks matching sectors, catches stars for one-shot color bonuses, slows down in clouds, finishes the run, shows the results board, and starts again.

## Current MVP

- Rotating 3D tower rendered with Three.js.
- `floors` / `N` URL parameter with default value `100`.
- Four sectors per floor.
- Gray sectors are always breakable.
- Colored sectors require a matching one-shot star bonus.
- Gold stars give a universal one-shot break.
- Clouds slow falling by 2x until the next floor contact.
- Random cartoon jumper for each run.
- HUD with time, floors, score, combo, bonus, and run number.
- Result board for 5 seconds after all floors are broken.
- Automatic restart after each run.
- Camera stays fixed in a close-up throughout the run, independent of floor
  count. The tower's base stays in place and rotates; after each break, the
  jumper bounces upward and remaining floors slide upward to the active position.
  Collisions use the floors' actual animated positions.
- Combo counts consecutive successful breaks, resetting on an unbreakable contact.

## Setup

Use Node.js 22.6+ (Node.js 24 recommended).

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

Queue and record tests:

```bash
npm test
```

## Stream Events (Operator Preview)

Open `/?operator=1` to display the operator panel. It can queue a gold star,
30 seconds of doubled cloud frequency, 20 seconds of 25% faster rotation,
a character for the next available run, or five seconds of fireworks.
The ordinary streaming URL hides these controls.

This is a local preview, not a payment integration or an authenticated admin
panel. No payments are accepted. A future server must verify provider callbacks
before submitting events; an `operator` URL flag is not authentication.

Mechanics execute in order, while fireworks can run alongside them. Matching
cloud/turbo events extend the active effect up to 60 seconds without overtaking
other mechanics. Each queued gold event waits for its own star to be collected
or expire. Effects reset on finish; events waiting during results remain queued.
If a run finishes without a bounce, an unspawned requested gold star stays queued.
Character choices are consumed one per new run.

The queue is persisted in this browser's LocalStorage. Interrupted running
events are marked for review instead of being replayed. This is not server-side
durability or a shared queue across browsers. Clearing browser data clears the
queue and records. Storage failure does not stop the game.

Records are separate for standard and supported runs and every game-parameter
configuration. Mechanics events mark a run as supported; cosmetic fireworks
and character selection do not. The old unqualified record is ignored because
its floor count and configuration cannot be established.
Records from the former falling-through-floors mechanic are also kept separate
from the new bounce-and-lift mechanic (record storage version 3).

The tower and results use a typographic YTFunStream logo. Sponsor scheduling,
advertiser assets, payment callbacks, seasons, and video clipping are not yet
implemented.

## URL Parameters

```text
/?floors=100&speed=1.2&stars=0.8&clouds=0.4
```

Supported parameters:

- `floors` or `N` — floor count, default `100`
- `speed` — tower rotation speed, default `1.15`
- `stars` — star spawn rate, default `0.85`
- `clouds` — cloud spawn rate, default `0.28`
- `gold` — gold star chance, default `0.12`
- `gravity` — gravity value, default `12.5`
- `bounce` — bounce force, default `8.9`

## Streaming

The game chooses a random bundled city photograph when the page opens and keeps
it throughout the session. The catalog includes Singapore, Tokyo, and New York.
It works without an external image request at runtime.
Photo source and license are in `public/assets/CREDITS.md`.

To add backgrounds, place JPG, JPEG, PNG, WebP, or AVIF files in
`src/assets/cities/`. Use descriptive filenames, for example `moscow-city.jpg`.
Vite discovers them automatically; restart the development server or rebuild
the production app after changing the catalog. Reload the page to make a new
random selection (the same image can be selected again).

Click **Включить музыку** to start the original upbeat procedural background
music. Browsers require a user gesture for sound; the game still starts without
one. The volume slider is saved locally, and music continues across runs.
For streaming, enable music once and make sure OBS captures the browser's audio.

Open the app in a browser and capture the window or tab in OBS. The game starts automatically and does not require input.
