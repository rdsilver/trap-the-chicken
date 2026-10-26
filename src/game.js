// Pure game rules for Trap the Chicken. No DOM access, so it can be tested in Node.
//
// The puzzle: one chicken hides in one of the coops. Each night you search a few
// coops. If it isn't in any of them, it must move to another coop according to its
// move pattern. You can't see the chicken, so the game tracks every coop it *could*
// be in. Shrink that set to nothing and the chicken is trapped.

/** Moves are [rowDelta, colDelta]. */
export const PIECES = {
  chicken: {
    name: 'Chicken',
    image: 'images/chicken.png',
    moves: [[0, -1], [0, 1], [1, 0], [-1, 0]],
    rule: 'Hops to the next coop up, down, left or right.',
  },
  knight: {
    name: 'Knight',
    image: 'images/knight.png',
    moves: [[-2, -1], [-1, -2], [1, -2], [1, 2], [-2, 1], [2, 1], [2, -1], [-1, 2]],
    rule: 'Jumps in an L-shape, like a chess knight.',
  },
  rooster: {
    name: 'Super Rooster',
    image: 'images/rooster.png',
    moves: [[0, -1], [0, 1], [1, 0], [-1, 0], [0, -2], [0, 2], [2, 0], [-2, 0]],
    rule: 'Moves 1 or 2 coops up, down, left or right, and can jump over a coop.',
  },
};

/**
 * Turn a layout like ['oooo', 'o--o'] into a board. 'o' is a coop, anything else is
 * empty ground. Cells are addressed by index = row * cols + col.
 */
export function parseLayout(layout) {
  const rows = layout.length;
  const cols = Math.max(...layout.map((line) => line.length));
  const coops = new Set();

  layout.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      if (ch === 'o') coops.add(row * cols + col);
    });
  });

  return { rows, cols, coops };
}

export function toRowCol(board, cell) {
  return [Math.floor(cell / board.cols), cell % board.cols];
}

/** Coops a piece standing on `cell` could move to tonight. */
export function movesFrom(board, piece, cell) {
  const [row, col] = toRowCol(board, cell);
  const targets = [];

  for (const [dr, dc] of PIECES[piece].moves) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= board.rows || c < 0 || c >= board.cols) continue;

    const target = r * board.cols + c;
    if (board.coops.has(target)) targets.push(target);
  }

  return targets;
}

/**
 * Resolve one night. Searching rules out the searched coops, then the chicken moves
 * from wherever it could still be.
 *
 * Returns the coops it could have survived in, every possible move it could make,
 * the coops it could be in tomorrow, and whether it's been caught.
 */
export function playNight(board, piece, possible, searched) {
  const survivors = new Set([...possible].filter((cell) => !searched.has(cell)));
  const moves = [...survivors].flatMap((from) =>
    movesFrom(board, piece, from).map((to) => ({ from, to })),
  );
  const next = new Set(moves.map((move) => move.to));

  return { survivors, moves, next, caught: next.size === 0 };
}

/** At the start, the chicken could be in any coop. */
export function startingPossibilities(board) {
  return new Set(board.coops);
}
