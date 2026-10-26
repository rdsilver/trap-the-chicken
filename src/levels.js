// 'o' is a coop, '-' is empty ground. `searches` is how many coops you can check per night.
// `par` is the fewest nights that guarantees a catch (computed by tools/solve.js).
export const LEVELS = [
  { name: 'Two Coops', piece: 'chicken', searches: 1, par: 2, layout: ['oo'] },
  { name: 'In a Row', piece: 'chicken', searches: 1, par: 4, layout: ['oooo'] },
  { name: 'Five in a Row', piece: 'chicken', searches: 1, par: 6, layout: ['ooooo'] },
  { name: 'Little Square', piece: 'chicken', searches: 2, par: 2, layout: ['oo', 'oo'] },
  { name: 'Three by Three', piece: 'chicken', searches: 3, par: 4, layout: ['ooo', 'ooo', 'ooo'] },
  {
    name: 'Four by Four',
    piece: 'chicken',
    searches: 5,
    par: 4,
    layout: ['oooo', 'oooo', 'oooo', 'oooo'],
  },
  { name: 'The Ring', piece: 'chicken', searches: 2, par: 10, layout: ['oooo', 'o--o', 'o--o', 'oooo'] },
  {
    name: 'Crooked Ring',
    piece: 'chicken',
    searches: 2,
    par: 10,
    layout: ['oooo', 'o-oo', 'oo-o', 'oooo'],
  },
  {
    name: 'Tighter Budget',
    piece: 'chicken',
    searches: 4,
    par: 6,
    layout: ['oooo', 'oooo', 'oooo', 'oooo'],
  },
  { name: 'Hourglass', piece: 'chicken', searches: 2, par: 6, layout: ['oooo', '-oo-', '--o-', 'oooo'] },
  {
    name: 'Knight Moves',
    piece: 'knight',
    searches: 8,
    par: 4,
    layout: ['ooooo', 'ooooo', 'ooooo', 'ooooo', 'ooooo'],
  },
  {
    name: 'Super Rooster',
    piece: 'rooster',
    searches: 12,
    par: 4,
    layout: ['ooooo', 'ooooo', 'ooooo', 'ooooo', 'ooooo'],
  },
  { name: 'Ladder', piece: 'chicken', searches: 2, par: 8, layout: ['oooo', '-o-o', '-o-o', 'oooo'] },
];
