# Beach Day

A calm sand-sorting game. Bottles hold layers of colored sand; pour from one bottle to another until every bottle is a single color.

Play at https://radr500-dot.github.io/Games/beach-day/ (on iPhone: Safari → Share → Add to Home Screen).

## How to play

- Each bottle holds four layers. Tap a bottle to pick it up, then tap another to pour its top layer in.
- Sand can go into an empty bottle or onto the same color, if there's room. Matching layers on top pour together.
- No timer and no way to lose: unlimited **Undo**, **Restart**, and a **Spare** empty bottle once per level.
- **Hint** suggests a good next pour and explains why in words. If the mix gets tangled beyond rescue, the hint offers to take you back to the last point that can still be finished.
- Light look "Shoreline", dark look "Moonlit Bay", or match the phone (Settings).
- On a computer: number keys 1 to 9 pick bottles, Ctrl/⌘+Z undoes, H gives a hint.

## How it works

- `engine.js`: the pouring rules, a seeded level maker (level N is always the same puzzle) and a depth-first solver. Every level is checked by the solver before it's shown, so it can always be solved. Hints come from the same solver.
- `app.js`: screens, drawing, saving progress (localStorage, `bd-` keys).
- Levels grow from 3 colors to 7. Endless.
- `sw.js` keeps an offline copy (cache `beach-day-vN`).
