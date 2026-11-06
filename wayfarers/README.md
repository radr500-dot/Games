# Wayfarers

A calm 3D runner. Steer your band of travelers down a road through rolling hills, pick the better gate, knock down walls and rival bands, and collect the coins they drop. Spend the coins on upgrades, then travel on through seven ages: Stone Age, Bronze Age, Castle Age, Age of Sail, Steam Age, Modern Age and Space Age.

Play at https://radr500-dot.github.io/Games/wayfarers/ (iPhone: Safari → Share → Add to Home Screen).

## How to play

- Drag left and right to steer (arrow keys or A/D on a computer). Your band runs and throws by itself.
- **Blue gates** add travelers or multiply them. **Gray gates** take some away, but each hit you land raises the number. **Orange gates** speed up throws or add reach for the rest of the stage.
- **Walls** show how many hits they can take. If your band runs into a wall, the travelers at the front push it down, and you lose them. Half walls can be dodged.
- **Rival bands** walk toward you. Knock them over before they reach you.
- **Crates** are full of coins.
- Past the finish line, the **bonus stairs** (×1.2 up to ×3.0) multiply the coins you picked up.

## Calm by design

- No energy, no lives, no timer and no ads.
- If your band runs out, you keep every coin, and the next try on that stage has softer walls and smaller rival bands.
- Pause at any time. There are three running paces (Relaxed, Steady and Brisk), a Daytime/Dusk look and a sound switch.

## Upgrades

Bigger band (more travelers at the start), Stronger throws, Quicker hands, Longer reach, Lucky coins and Coin magnet. Each new age also makes every throw stronger.

## Files

- `index.html`, `style.css`, `app.js`: screens, saving, shop and settings
- `game.js`: the 3D world and the run (built on three.js, in `vendor/`, MIT license)
- `models.js`: low-poly scenery, travelers and props, built from simple shapes
- `eras.js`: the seven ages, their colors and the upgrade list
- `audio.js`: soft sounds made in code
- `sw.js`: offline copy and updates (cache `wayfarers-vN`; bump it on every change)
