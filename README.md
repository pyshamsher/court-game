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
- DUPR ratings — optional manual entry per player, shown as teal badges during games
- 🔍 Fetch DUPR Ratings — log in with DUPR account to auto-fetch doubles ratings for all players
- Fuzzy name matching for DUPR lookups (last name priority, prefix matching)
- 📊 Sort by DUPR — auto-seeds player list by rating (highest = seed 1)
- Auto-sort after DUPR fetch

## Dev Instance
- **Live Site:** https://pickleball-tracker-dev.surge.sh
- **Local File:** `~/court-game/dev.html`
- **Firebase paths:** `/dev-game`, `/dev-archive`, and `/dev-rr` (isolated from production)
- Has a `DEV` badge in the header to distinguish from production
- **Deploy:**
  ```bash
  cp ~/court-game/dev.html /tmp/pickleball-dev/index.html && npx surge /tmp/pickleball-dev pickleball-tracker-dev.surge.sh
  ```

### Dev-Only Features
- **🔄 Round Robin mode** — generates all valid doubles matchups, schedules into rounds, live standings leaderboard with win/loss/percentage
- **DUPR ratings** — optional rating field per player in setup, shown as teal badges during games and in standings
- **📊 Sort by DUPR** — auto-seeds player list by rating (highest = seed 1)
- **Balanced RR pairing** — when DUPR ratings are entered, teams are formed via snake draft (strongest + weakest) for fair matchups; falls back to all combos if no ratings
- **📊 Sort by DUPR** — auto-seeds player list by rating (highest = seed 1)
- **Balanced RR pairing** — when DUPR ratings are entered, teams are formed via snake draft (strongest + weakest) for fair matchups; falls back to all combos if no ratings

## Files
- `~/court-game/index.html` — the production app (single file)
- `~/court-game/dev.html` — the dev app (isolated Firebase paths)
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

### March 22, 2026
- **Dev instance** — separate site at pickleball-tracker-dev.surge.sh with isolated Firebase paths (`/dev-game`, `/dev-archive`, `/dev-rr`)
- **🔄 Round Robin mode** (dev only) — generates all doubles matchups, schedules into rounds, live standings leaderboard
- **Balanced RR pairing** (dev only) — snake draft team formation when DUPR ratings are entered
- **DUPR ratings** — optional rating field per player in setup, teal badges shown during games
- **🔍 Fetch DUPR Ratings** — log in with DUPR account to auto-fetch doubles ratings for all players
- **Self-match fix** — uses logged-in user's own profile from login response to match players the search API can't find
- **Last-name fallback** — retries search with last name only when full name returns no hits
- **Canada geo filter** — DUPR search limited to 1000km radius from Calgary for better local matches
- **Interactive DUPR picker** — after fetch, shows dropdown per player with all search hits; re-search box to look up by full name; Apply button keeps unmatched players visible for correction
- **Auto-fill DUPR fields** — confident matches populate player list immediately before manual review
- **Fuzzy name matching** — last name priority, prefix matching for DUPR lookups
- **📊 Sort by DUPR** — auto-seeds player list by rating; auto-sorts after fetch

### March 20, 2026
- **Fixed Google Doc parser** — the exported text has no newlines and paired date headers (e.g. `WED MARCH 25 FRI MARCH 27`) appear side-by-side with all players after the second header. The old parser doubled player counts (~32 instead of 16) and missed the first date entirely.
  - Detects numbering restart at `1.` to split paired dates' player lists
  - Parses individual numbered entries from continuous single-line text
  - Caps last player name to 2 words to exclude trailing unnumbered waitlist names
  - Filters out `?` placeholder slots for unfilled spots
