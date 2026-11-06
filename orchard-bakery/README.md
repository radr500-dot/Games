# Orchard Bakery

A calm 3D bakery game. Walk your baker around a little country farm, pick apples and wheat,
bake pies and bread in wood-fired ovens, set them out on the market stall, and collect the
coins your customers leave. Spend coins to grow the bakery: more apple trees, a bigger tray,
a wheat field, a bread oven, a tea garden, a flower garden and two helpers.

There are no timers, no lives and nothing to fail. Progress saves on its own, so you can stop any time.

Play at https://radr500-dot.github.io/Games/orchard-bakery/

## How to play

- **Walk:** on iPhone, put your thumb anywhere and drag (a joystick appears under your thumb).
  On a computer, use the arrow keys or WASD, or click and drag.
- **Zoom:** pinch on iPhone, or scroll on a computer.
- **Pick:** walk up to an apple tree (or through the wheat) and the fruit hops onto your tray.
- **Bake:** stand on the "Apples in" circle by the oven. Pies come out on the table next to it.
- **Sell:** carry the pies to the "Stall" circle behind the market stall. Customers come up the road and buy them.
- **Collect:** stand on the "Coins" circle by the barrel.
- **Build:** stand on a building spot until it's paid for.
- The note at the top always says what to do next, and a gold arrow shows the way if you stand still for a moment.

## Notes

- Light mode only (Rachel asked for no dark mode in this game).
- Everything is drawn in code with [three.js](https://threejs.org) (in `vendor/`, MIT licence); no downloaded art.
- `models.js` builds the items and people, `world.js` lays out the farm, `app.js` runs the game.
- If a phone struggles, the game lowers its resolution a little so movement stays smooth.
- Service worker cache: `orchard-bakery-vN`. Bump it whenever the game changes.
