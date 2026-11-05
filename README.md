# Games

This is where I store all the new mobile games I build. They're my own ad-free games that I can play on my phone.

## How this repo is organized

Each game gets its own folder at the top level of the repo:

```
Games/
├── README.md          ← this file
├── index.html         ← the My Games home screen (hub.css, hub.js, sw.js, icons/)
├── games.json         ← the list of games the home screen shows
├── <game-one>/
│   ├── README.md      ← what the game is and how to play / run it
│   └── ...            ← the game's code and assets
└── <game-two>/
    ├── README.md
    └── ...
```

## The My Games home screen

https://radr500-dot.github.io/Games/ is the home screen: a card for every game, with a light/dark switch. Add it to the iPhone home screen (Safari → Share → Add to Home Screen) or open it in a desktop browser. It reads its cards from `games.json`, so a game appears there as soon as it's listed in that file.

Note: on iPhone each home-screen icon keeps its own saved games. Games opened from the My Games icon have their own progress, separate from any older per-game icon.

## Adding a new game

1. Create a new top-level folder named after the game, in lowercase with dashes (for example `tile-match`).
2. Put everything for that game inside its folder. Games don't share files with each other, so each one stays self-contained.
3. Add a `README.md` inside the folder that says what the game is, how to play it, and how to open or run it on a phone.
4. **Add the game to `games.json`** so it shows on the home screen:
   ```json
   { "folder": "tile-match", "name": "Tile Match", "tagline": "One short line about the game.", "icon": "tile-match/icons/icon-192.png" }
   ```
5. **Give the game a way back home.** Every game needs a "My Games" button (`<a href="../">`) on its own start screen and a home icon in its in-game top bar, like Plot Twist and Daybreak do (see `.hub-pill` and `.hub-link` in their `style.css`).
6. If the game has a service worker, name its cache `<folder>-vN` and only delete caches that start with `<folder>-`. All games share one site, so clearing every other cache would wipe the other games' offline copies.
7. Add the game to the list below.

## Ground rules

- No ads, no forced waits, no pop-ups.
- Every game has a clear way back to the My Games home screen: a "My Games" button on its start screen and a home icon in the top bar while playing. A game isn't finished without it.
- Every game is listed in `games.json` so it shows on the home screen.
- Every game is an original build with its own name, art, and levels. Games can play like a genre I enjoy, but they don't copy an existing game's name, characters, art, or music.

## Games

Home screen: https://radr500-dot.github.io/Games/


- [Plot Twist](plot-twist/): one bloom per row, column and plot. Play at https://radr500-dot.github.io/Games/plot-twist/
- [Daybreak](daybreak/): balance the suns and moons. Play at https://radr500-dot.github.io/Games/daybreak/
