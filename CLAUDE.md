# Notes for building games in this repo

Follow the "Adding a new game" steps and "Ground rules" in README.md for every new game. In short:

- Each game lives in its own top-level folder and is an original build.
- Add the game to `games.json` so it appears on the My Games home screen.
- Every game must have a visible way back to My Games: a "My Games" button (`<a href="../">`) on its start screen and a home icon in its in-game top bar. Copy the `.hub-pill` / `.hub-link` pattern from Plot Twist or Daybreak.
- Service worker caches are named `<folder>-vN` and a game only deletes its own caches. Copy the update pattern from Beach Day: `fresh()` (no-cache fetch) in `sw.js`, and reload-on-`controllerchange` plus `update()` on return to the app in `app.js`. Bump `vN` on every change, or phones keep the old version.
- Calm, no-pressure play; a light/dark switch; it must work on iPhone and desktop.
