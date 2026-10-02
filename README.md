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

## Setup

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

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

Open the app in a browser and capture the window or tab in OBS. The game starts automatically and does not require input.
