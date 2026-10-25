import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PIECES, movesFrom, parseLayout, playNight, startingPossibilities } from '../src/game.js';
import { LEVELS } from '../src/levels.js';
import { solve } from '../tools/solve.js';
import { SOLUTIONS } from './solutions.js';

const sorted = (set) => [...set].sort((a, b) => a - b);

test('parseLayout reads coops and gaps', () => {
  const board = parseLayout(['oo-', '-oo']);
  assert.equal(board.rows, 2);
  assert.equal(board.cols, 3);
  assert.deepEqual(sorted(board.coops), [0, 1, 4, 5]);
});

test('chickens move one step and never into a gap', () => {
  const board = parseLayout(['ooo', 'o-o', 'ooo']);
  assert.deepEqual(movesFrom(board, 'chicken', 1).sort(), [0, 2]);
  assert.deepEqual(movesFrom(board, 'chicken', 0).sort(), [1, 3]);
});

test('knights jump in an L and stay on the board', () => {
  const board = parseLayout(['ooooo', 'ooooo', 'ooooo', 'ooooo', 'ooooo']);
  assert.deepEqual(movesFrom(board, 'knight', 0).sort((a, b) => a - b), [7, 11]);
  assert.equal(movesFrom(board, 'knight', 12).length, 8);
});

test('super roosters move one or two coops in a line', () => {
  const board = parseLayout(['ooooo', 'ooooo', 'ooooo', 'ooooo', 'ooooo']);
  assert.deepEqual(movesFrom(board, 'rooster', 12).sort((a, b) => a - b), [2, 7, 10, 11, 13, 14, 17, 22]);
});

test('playNight rules out searched coops, then spreads', () => {
  const board = parseLayout(['oooo']);
  const night = playNight(board, 'chicken', new Set([0, 1, 2, 3]), new Set([1, 2]));
  assert.deepEqual(sorted(night.survivors), [0, 3]);
  assert.deepEqual(sorted(night.next), [1, 2]);
  assert.equal(night.caught, false);
});

test('searching every possible coop catches the chicken', () => {
  const board = parseLayout(['oooo']);
  const night = playNight(board, 'chicken', new Set([1, 3]), new Set([1, 3]));
  assert.equal(night.caught, true);
  assert.equal(night.moves.length, 0);
});

// The original jQuery version's "Check" button, ported line for line (minus the DOM),
// so we can prove the rewrite plays by exactly the same rules.
const ORIGINAL_SYMBOL = { chicken: '.', knight: 'k', rooster: 's' };
const ORIGINAL_MOVES = {
  '.': [[0, -1], [0, 1], [1, 0], [-1, 0]],
  k: [[-2, -1], [-1, -2], [1, -2], [1, 2], [-2, 1], [2, 1], [2, -1], [-1, 2]],
  s: [[0, -1], [0, 1], [1, 0], [-1, 0], [0, -2], [0, 2], [2, 0], [-2, 0]],
};

function originalCheck(grid) {
  const newGrid = grid.map((row) => row.map(() => 'placeholder'));

  for (const [key, neighbors] of Object.entries(ORIGINAL_MOVES)) {
    for (let row = 0; row < grid.length; row++) {
      for (let column = 0; column < grid[row].length; column++) {
        if (grid[row][column] === '') {
          newGrid[row][column] = '';
          continue;
        }
        const hasNeighbor = neighbors.some(
          ([dr, dc]) =>
            row + dr >= 0 &&
            row + dr < grid.length &&
            column + dc >= 0 &&
            column + dc < grid[row].length &&
            grid[row + dr][column + dc] === key,
        );
        if (hasNeighbor) newGrid[row][column] = key;
      }
    }
  }

  return newGrid.map((row) => row.map((cell) => (cell === 'placeholder' ? '-' : cell)));
}

function seededRandom(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

test('new engine matches the original game on random playthroughs', () => {
  const random = seededRandom(42);

  for (const level of LEVELS) {
    const board = parseLayout(level.layout);
    const symbol = ORIGINAL_SYMBOL[level.piece];

    for (let game = 0; game < 200; game++) {
      let possible = startingPossibilities(board);
      let grid = level.layout.map((line) => [...line].map((ch) => (ch === 'o' ? symbol : '')));

      for (let night = 0; night < 12 && possible.size; night++) {
        const candidates = sorted(possible).sort(() => random() - 0.5);
        const searched = new Set(candidates.slice(0, Math.ceil(random() * level.searches)));

        for (const cell of searched) grid[Math.floor(cell / board.cols)][cell % board.cols] = 'x';
        grid = originalCheck(grid);
        const result = playNight(board, level.piece, possible, searched);
        possible = result.next;

        const originalPossible = grid
          .flat()
          .map((cell, i) => (cell === symbol ? i : -1))
          .filter((i) => i >= 0);
        assert.deepEqual(sorted(possible), originalPossible, `${level.name}, night ${night + 1}`);

        const originalWon = grid.flat().every((cell) => cell === '-' || cell === '');
        assert.equal(result.caught, originalWon);
      }
    }
  }
});

test('every level is solvable in par nights', () => {
  LEVELS.forEach((level, i) => {
    const board = parseLayout(level.layout);
    let possible = startingPossibilities(board);
    let caught = false;

    SOLUTIONS[i].forEach((night) => {
      assert.ok(night.length <= level.searches, `${level.name}: too many searches`);
      assert.ok(night.every((cell) => possible.has(cell)), `${level.name}: searched a ruled-out coop`);
      ({ next: possible, caught } = playNight(board, level.piece, possible, new Set(night)));
    });

    assert.ok(caught, `${level.name}: solution doesn't catch the chicken`);
    assert.equal(SOLUTIONS[i].length, level.par, `${level.name}: par is wrong`);
  });
});

test('par is the true minimum (small levels)', () => {
  LEVELS.forEach((level) => {
    // The 5x5 knight and rooster levels take too long to search exhaustively here.
    if (level.layout.length * level.layout[0].length > 16) return;
    assert.equal(solve(level).nights, level.par, level.name);
  });
});

test('every piece has art and a rule', () => {
  for (const piece of Object.values(PIECES)) {
    assert.ok(piece.image && piece.rule && piece.moves.length);
  }
});
