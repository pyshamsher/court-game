# Pickleball Court Tracker

## Live Site
https://pickleball-tracker.surge.sh

## Passcode
`pickle2026`

## Deploy Changes
```bash
npx surge ~/court-game pickleball-tracker.surge.sh
```
Surge account: mr.shamshersingh@gmail.com

## Firebase
- Project: pickleball-tracker-2ce69
- Console: https://console.firebase.google.com/project/pickleball-tracker-2ce69/overview
- Database: https://pickleball-tracker-2ce69-default-rtdb.firebaseio.com/
- Database is in **test mode** (open read/write — consider adding rules later)
- Firebase config is embedded in index.html

## Google Doc Integration
- Source: https://docs.google.com/document/d/12111pYeuP-AgHln3_F2Fkha8jMoTxqInJQK-HX_r9ss/edit
- Export URL: https://docs.google.com/document/d/12111pYeuP-AgHln3_F2Fkha8jMoTxqInJQK-HX_r9ss/export?format=txt
- Doc must stay publicly accessible ("Anyone with the link" → Viewer)
- App fetches latest player lists on every load
- Dates are parsed from headers like "WED MARCH 18", "FRI MARCH 20"

## Game Rules
- 4 players per court, paired as #1+#4 (Top of Court) vs #2+#3 (Bottom of Court)
- Winners become Seeds 1 & 2, losers become Seeds 3 & 4
- Seed 4 (bottom loser) always drops to the court below as Seed 1
- Top winner (Seed 1) from the court below promotes up to Seed 4
- Top 2 seeds need 2 consecutive losses to drop; bottom 2 need only 1
- Players who switch courts get their loss counter reset

## Features
- Passcode-protected access (session-based, survives tab close within browser session)
- Real-time sync across all devices via Firebase
- Google Doc integration — pulls player lists by date
- Player reordering: ▲/▼ arrows, # jump-to-position, ✕ remove, + add
- Session tracking with start time and date label
- Round timestamps in history log
- Consecutive loss tracking (L×1, L×2) per player
- Detailed movement log after each round (⬆️ promotions, ⬇️ drops)
- ↩ Change button to fix wrong result before applying round
- ↩ Undo button to revert last applied round (or go back to setup from Round 1)
- Past Sessions archive — view all previous date-linked games
- 🎲 Quick Game mode — random games with no history saved
- Dynamic court count with auto-filled dummy names
- Reset confirmation (affects all connected devices)

## Files
- `~/court-game/index.html` — the entire app (single file)
- `~/court-game/README.md` — this file

## Tech Stack
- Single HTML file (no build step)
- Firebase Realtime Database for live sync and session archive
- Hosted on Surge.sh (free)
- Google Docs export API for player schedule

## Firebase Data Structure
```
/game          — current active game state
/archive/      — past sessions keyed by date + timestamp
  ├── WED MARCH 18_2026-03-18T...
  │   ├── sessionDate
  │   ├── sessionStart
  │   ├── sessionEnd
  │   ├── players
  │   ├── history
  │   └── rounds
  └── FRI MARCH 20_2026-03-20T...
```

## Notes
- Firebase test mode rules expire after 30 days — update security rules before then
- Quick Games (🎲) are not archived on reset
- Each browser session needs to enter the passcode once

## Changelog

### March 20, 2026
- **Fixed Google Doc parser** — the exported text has no newlines and paired date headers (e.g. `WED MARCH 25 FRI MARCH 27`) appear side-by-side with all players after the second header. The old parser doubled player counts (~32 instead of 16) and missed the first date entirely.
  - Detects numbering restart at `1.` to split paired dates' player lists
  - Parses individual numbered entries from continuous single-line text
  - Caps last player name to 2 words to exclude trailing unnumbered waitlist names
  - Filters out `?` placeholder slots for unfilled spots
