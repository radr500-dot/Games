# Plot Twist

A calm logic puzzle set in a garden. Plant exactly one bloom in every row, every column and every colored plot, and keep blooms from touching, not even corner to corner.

It's an original game built on a classic public-domain puzzle idea (the same family as "Star Battle" and the eight-queens problem), with its own name, look and freshly generated puzzles. No ads, no waiting, no sign-in.

## Why "Plot Twist"

The board is a garden split into plots, and the fun of each puzzle is the moment one plot forces a bloom somewhere you didn't expect. Garden plots plus a twist.

## How to play

- **Tap** a square once for an ✕ (your note for "not here"), again for a bloom, and again to clear it.
- **Drag** across squares to mark lots of them with ✕ at once.
- Blooms that break a rule get striped.
- **Hint** teaches the next step: it names the rule, highlights the squares that prove it, and explains why. Tap the button on the hint to apply it, or close it and do it yourself. It points out mistakes first.

Every puzzle can be finished with logic alone, no guessing needed.

### Light and dark

Light mode is the **Garden** (flowers). Dark mode is the **Night Sky** (gold stars). Switch with the sun/moon button, or pick "Match phone" in Settings.
- **Undo**, **Clear** and **New** do what they say.

On a computer you can also right-click to plant or remove a bloom, and use the keyboard: arrow keys move, Space cycles a square, B places a piece, X toggles an ✕, Ctrl/⌘+Z undoes, H gives a hint.

### Modes

- **Today's garden**: one 8 × 8 puzzle per day (the same all day), with a streak counter.
- **Free play**: endless puzzles in five sizes, from Sprout (6 × 6) to Wilds (10 × 10). Best times are kept for puzzles solved without hints.

Your game in progress, best times and settings are saved on the device, so you can close the app and pick up where you left off. Settings include light/dark, auto-✕ around new pieces, clash highlights, vibration and the timer (off by default, to keep things relaxed).

## Install on iPhone

1. Open the game's web address in **Safari** on your iPhone.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**, then **Add**.

Plot Twist now has its own icon and opens full screen like a normal app. After the first open it also works with no internet connection.

## Play on a computer

Open the same web address in any browser (Chrome, Safari, Edge or Firefox). In Chrome or Edge you can also click the install icon at the right end of the address bar to give it its own window.

## Hosting

The repo's `Publish games` workflow (`.github/workflows/pages.yml`) publishes every game to GitHub Pages when `main` changes. Plot Twist lives at:

`https://radr500-dot.github.io/Games/plot-twist/`

GitHub Pages only runs on a private repo with a paid GitHub plan, so for a free account the repo needs to be public (the code becomes viewable, but nobody is told the address). Then turn it on once in **Settings → Pages → Source: GitHub Actions**.

## Running it locally

It's plain HTML, CSS and JavaScript with no build step. From this folder run `python3 -m http.server` and open `http://localhost:8000`.

## How the puzzles are made

`generator.js` places one bloom per row and column with no two touching, grows a plot around each bloom, then nudges plot borders one square at a time until a solver confirms the puzzle has exactly one solution. `hints.js` then checks the puzzle can be solved step by step with the same rules the hints explain, and the generator keeps only puzzles that pass. The generator runs in a background worker (`worker.js`) so the screen never freezes, even on the 10 × 10 size.
