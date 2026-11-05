# Daybreak

A calm sun and moon logic puzzle. Fill the grid so every row and column is in balance.

It's an original game built on a classic public-domain puzzle idea (the "binary grid" family, also known as Takuzu or Binairo), with its own name, look and freshly generated puzzles. No ads, no waiting, no sign-in.

Play at https://radr500-dot.github.io/Games/daybreak/

## How to play

- Fill every square with a **sun** or a **moon**.
- Each row and column gets the **same number** of each (3 and 3 on a 6 × 6 board).
- **No three in a row**: never three suns or three moons side by side, across or down.
- An **=** sign between two squares means they match. A **≠** sign means they're opposites.
- Shaded squares come with the puzzle and can't be changed.

**Tap** a square once for a sun, twice for a moon, and again to clear it. If something breaks a rule, the squares get soft stripes and the line under the board says which rule.

**Hint** teaches the next step: it names the rule, outlines the squares that prove it, and explains why in words. Tap the button on the hint to place it, or close it and do it yourself. It points out mistakes first. For the trickier steps it walks through "suppose this were a sun..." to show why that can't work.

Every puzzle has exactly one answer, and you can always reach it by logic alone, no guessing.

On a computer: right-click cycles backwards (moon first). Arrow keys move, Space cycles a square, S places a sun, M places a moon, Backspace clears, Ctrl/⌘+Z undoes, H gives a hint.

### Modes

- **Today's sky**: one 6 × 6 puzzle per day (the same all day).
- **Free play**: Dawn (6 × 6, gentle), Midday (8 × 8) and Dusk (10 × 10).

### Light and dark

Light mode is warm daylight cream; dark mode is a midnight sky. Switch with the sun/moon button, or pick "Match phone" in Settings. The timer is off by default (turn it on in Settings).

## Add it to your iPhone home screen

Open the link in Safari, tap Share, then **Add to Home Screen**. It opens full screen and works offline.

## Files

- `engine.js`: puzzle generator, logic solver and hint explanations. Puzzles are made by starting from a full grid and removing squares and signs only while the solver can still finish using the rules a person would use, which also guarantees a single answer.
- `app.js`, `index.html`, `style.css`: the game.
- `sw.js`, `manifest.webmanifest`, `icons/`: home screen and offline support.
