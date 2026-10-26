// Finds the fewest nights that guarantee a catch on each level, plus one way to do it.
//
//   node tools/solve.js          # all levels
//   node tools/solve.js 7 8      # just levels 7 and 8 (1-based)
//
// Breadth-first search over "where could the chicken be" sets, stored as bitmasks.
// Moving is monotone (a smaller set never spreads to a bigger one), so any state that
// is a superset of another state at the same depth can be dropped.

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { LEVELS } from '../src/levels.js';
import { movesFrom, parseLayout } from '../src/game.js';

export function solve(level) {
  const board = parseLayout(level.layout);
  const cells = [...board.coops];
  const bitOf = new Map(cells.map((cell, i) => [cell, i]));
  const spread = cells.map((cell) =>
    movesFrom(board, level.piece, cell).reduce((mask, to) => mask | (1 << bitOf.get(to)), 0),
  );
  const move = (mask) => {
    let out = 0;
    for (let i = 0; mask; i++, mask >>>= 1) if (mask & 1) out |= spread[i];
    return out;
  };
  const toCells = (mask) => cells.filter((_, i) => mask & (1 << i));

  const start = (1 << cells.length) - 1;
  const parent = new Map([[start, null]]);
  let layer = [start];

  for (let night = 1; layer.length; night++) {
    const found = new Map();

    for (const state of layer) {
      const bits = [];
      for (let i = 0; i < cells.length; i++) if (state & (1 << i)) bits.push(i);
      const k = Math.min(level.searches, bits.length);

      // Searching fewer coops than allowed never helps, so only try subsets of size k.
      const pick = (startAt, left, searched) => {
        if (left === 0) {
          const next = move(state & ~searched);
          if (!found.has(next)) found.set(next, { from: state, searched });
          return;
        }
        for (let i = startAt; i <= bits.length - left; i++) {
          pick(i + 1, left - 1, searched | (1 << bits[i]));
        }
      };
      pick(0, k, 0);
    }

    if (found.has(0)) {
      const path = [];
      let step = found.get(0);
      while (step) {
        path.unshift(toCells(step.searched));
        step = parent.get(step.from);
      }
      return { nights: night, solution: path };
    }

    // Keep only minimal, unseen states.
    const candidates = [...found.keys()]
      .filter((s) => !parent.has(s))
      .sort((a, b) => popcount(a) - popcount(b));
    const kept = [];
    for (const s of candidates) {
      if (kept.some((k) => (k & s) === k)) continue;
      kept.push(s);
      parent.set(s, found.get(s));
    }
    layer = kept;
  }

  return { nights: Infinity, solution: null };
}

function popcount(n) {
  let count = 0;
  for (; n; n &= n - 1) count++;
  return count;
}

// Run as a script (not imported by the tests). Compare real paths so spaces, symlinks and
// Windows paths all work.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const wanted = process.argv.slice(2).map(Number);
  LEVELS.forEach((level, i) => {
    if (wanted.length && !wanted.includes(i + 1)) return;
    const started = performance.now();
    const { nights, solution } = solve(level);
    const ms = Math.round(performance.now() - started);
    console.log(`Level ${i + 1} (${level.name}): ${nights} nights  [${ms}ms]`);
    console.log(`  ${JSON.stringify(solution)}`);
  });
}
