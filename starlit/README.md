# Starlit

A calm picture logic puzzle. Fill the right squares and a little picture appears.

It's an original game built on the classic public-domain "picture cross" puzzle (also called a nonogram, picross or griddler), with its own name, look and hand-drawn pictures. No ads, no lives, no traps, no timer, no sign-in.

Play at https://radr500-dot.github.io/Games/starlit/

## How to play

- The **numbers** beside each row and above each column say how many squares in that line are filled.
- **3 · 1** means a block of 3 filled squares, then a block of 1, in that order, with at least one empty square between them.
- Choose **Fill** and tap squares to fill them. Choose **Mark empty** to put an ✕ on squares you know stay empty. Tap a square again to clear it. Drag along a row or column to do several at once.
- When a line's numbers are done, they fade. With the setting on, the rest of that line gets ✕s for you.
- A wrong square is just a square you can tap again. If "Gently show wrong squares" is on, it gets soft stripes after a short pause.

**Hint** builds up in steps. First it points you to a good row or column. Then it outlines the squares you can be sure of and explains why in words (for example, "slide the block as far left as it goes, then as far right..."). If something's been filled by mistake, it points that out first. Every puzzle can be solved by logic alone, no guessing.

On a computer: right-click marks a square with ✕. Arrow keys move, Space fills, X marks, Backspace clears, Tab switches Fill and Mark, Ctrl/⌘+Z undoes, H gives a hint.

### Puzzles

- **First light** (5 × 5), **Evening** (8 × 8) and **Starry night** (10 × 10): 30 hand-drawn pictures. Solved pictures show up on the puzzle list. All of them are open from the start.
- **Stardust**: endless surprise patterns at 5 × 5, 8 × 8, 10 × 10 and 12 × 12, each checked to be solvable by logic.

Progress saves on the device as you go.

### Light and dark

**Dawn** (soft lavender and indigo) and **Midnight** (deep navy and gold). Switch with the moon/sun button, or set it to match the device in Settings.

## Files

- `index.html`, `style.css`, `app.js`: the screens and play.
- `engine.js`: clues, the line-logic solver, hints and Stardust puzzle making.
- `pictures.js`: the hand-drawn pictures.
- `sw.js`, `manifest.webmanifest`, `icons/`: offline play and home-screen install.

To check that every picture is solvable: `node -e "const E=require('./engine.js'),P=require('./pictures.js');for(const c of P.CHAPTERS)for(const p of c.pictures)if(!E.solve(E.cluesFor(E.parse(p.rows))).solved)console.log('needs a guess:',p.name)"`
