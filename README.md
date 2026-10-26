# Trap the Chicken

**Play it: https://rdsilver.github.io/trap-the-chicken/**

One chicken is hiding in one of the coops. Each night you can search a few of them. If you miss,
the chicken has to move to a neighboring coop. You can't see it, so the board highlights every coop it
_could_ be in. Shrink that area to nothing and it's trapped.

Later levels swap the chicken for a knight (moves like a chess knight) and a super rooster (moves one
or two coops in a straight line). Every level has a par: the fewest nights that guarantee a catch.

[Quick video explanation](https://www.youtube.com/watch?v=yZyx9gHhRXM)

## Running locally

It's a static site with no build step. ES modules don't load from `file://`, so serve the folder:

```sh
npm start            # or: python3 -m http.server 8000
```

Then open http://localhost:8000.

## Project layout

| Path                 | What it is                                                           |
| -------------------- | -------------------------------------------------------------------- |
| `src/game.js`        | The rules: pieces, moves, and resolving a night. No DOM.             |
| `src/levels.js`      | Level layouts, searches per night, and par.                          |
| `src/main.js`        | The UI: rendering, the night animation, saving progress.             |
| `tools/solve.js`     | Finds the fewest nights to guarantee a catch (and one way to do it). |
| `tools/solutions.js` | One shortest solution per level, checked by the tests.               |
| `test/`              | Tests, run with Node's built-in test runner.                         |

## Adding a level

Add an entry to `src/levels.js`. In `layout`, `o` is a coop and `-` is empty ground:

```js
{ name: 'The Ring', piece: 'chicken', searches: 2, par: 10, layout: ['oooo', 'o--o', 'o--o', 'oooo'] },
```

Then find its par and a solution with `npm run solve -- <level number>`, put the solution in
`tools/solutions.js`, and run `npm test`. The 5×5 levels take a while to solve (up to a couple of minutes).

## Tests

```sh
npm test
```

Needs Node 18 or newer. Among other things, the tests replay thousands of random games through a port
of the original jQuery version's rules to make sure the game still plays the same way.
