import { PIECES, movesFrom, parseLayout, playNight, startingPossibilities, toRowCol } from './game.js';
import { LEVELS } from './levels.js';

const ICONS = {
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/></svg>',
  cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
  flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/></svg>',
};

// ---------- Saved progress and settings ----------

const STORAGE_KEY = 'trap-the-chicken';
const saved = loadSaved();

function loadSaved() {
  const defaults = { best: {}, settings: { forecast: true, animate: true, autoSearch: false }, seenHelp: false };
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
    return { ...defaults, ...data, settings: { ...defaults.settings, ...data.settings } };
  } catch {
    return defaults;
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Private browsing or storage disabled: progress just won't be remembered.
  }
}

// ---------- State ----------

const state = {
  levelIndex: 0,
  level: LEVELS[0],
  board: parseLayout(LEVELS[0].layout),
  // One entry per night: where the chicken could be at dusk, and what was searched
  // (null for tonight, which hasn't been played yet).
  nights: [],
  selected: new Set(),
  phase: 'planning', // 'planning' | 'animating' | 'won'
  found: new Set(), // where the chicken was caught
};

const tonight = () => state.nights.at(-1);

let cellEls = new Map(); // cell index -> coop button
let arrowMoves = null; // moves currently drawn on the board, redrawn on resize
let run = 0; // bumped on every reset so an in-flight night animation knows to stop
let nudgeTimer;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

const $ = (selector) => document.querySelector(selector);
const els = {
  levelList: $('#level-list'),
  levelNumber: $('#level-number'),
  levelName: $('#level-name'),
  levelMeta: $('#level-meta'),
  night: $('#night-number'),
  status: $('#status'),
  boardWrap: $('#board-wrap'),
  board: $('#board'),
  arrows: $('#arrows'),
  controls: $('#controls'),
  undo: $('#undo-btn'),
  restart: $('#restart-btn'),
  search: $('#search-btn'),
  searchLabel: $('#search-label'),
  win: $('#win'),
  winTitle: $('#win-title'),
  winText: $('#win-text'),
  next: $('#next-btn'),
  replay: $('#replay-btn'),
  timeline: $('#timeline'),
  movesTitle: $('#moves-title'),
  movesDiagram: $('#moves-diagram'),
  movesRule: $('#moves-rule'),
  forecastCard: $('#forecast-card'),
  forecastBoard: $('#forecast-board'),
  forecastText: $('#forecast-text'),
  help: $('#help'),
  helpBtn: $('#help-btn'),
};

// ---------- Levels ----------

function startLevel(index) {
  run++;
  state.levelIndex = index;
  state.level = LEVELS[index];
  state.board = parseLayout(state.level.layout);
  state.nights = [{ possible: startingPossibilities(state.board), searched: null }];
  state.selected = new Set();
  state.phase = 'planning';
  state.found = new Set();

  buildBoard();
  renderPiece();
  renderLevelList();
  clearArrows();
  render();

  const hash = `#level-${index + 1}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

function levelFromHash() {
  const n = Number(location.hash.match(/^#level-(\d+)$/)?.[1]);
  return n >= 1 && n <= LEVELS.length ? n - 1 : null;
}

function buildBoard() {
  const { board, level } = state;
  els.boardWrap.style.setProperty('--cols', board.cols);
  els.board.dataset.piece = level.piece;
  cellEls = new Map();

  const nodes = [];
  for (let cell = 0; cell < board.rows * board.cols; cell++) {
    if (!board.coops.has(cell)) {
      const gap = document.createElement('div');
      gap.className = 'gap';
      nodes.push(gap);
      continue;
    }

    const coop = document.createElement('button');
    coop.type = 'button';
    coop.className = 'coop';
    coop.dataset.cell = cell;
    coop.tabIndex = cellEls.size === 0 ? 0 : -1;
    coop.style.setProperty('--i', cellEls.size);
    coop.innerHTML = `
      <img class="bird" src="${PIECES[level.piece].image}" alt="" draggable="false">
      <span class="hint-dot"></span>
      <span class="mark">${ICONS.cross}</span>
      <span class="badge">${ICONS.search}</span>`;
    cellEls.set(cell, coop);
    nodes.push(coop);
  }

  els.board.replaceChildren(...nodes);
}

// ---------- Rendering ----------

function render() {
  const { level, phase, selected } = state;
  const { possible } = tonight();
  const won = phase === 'won';

  for (const [cell, el] of cellEls) {
    const isPossible = !won && possible.has(cell);
    const isSelected = selected.has(cell);
    el.classList.remove('searching', 'stamp', 'leaving', 'arrived');
    el.classList.toggle('possible', isPossible);
    el.classList.toggle('selected', isSelected);
    el.classList.toggle('found', won && state.found.has(cell));
    el.setAttribute('aria-pressed', isSelected);
    el.setAttribute('aria-label', describeCell(cell, isPossible, isSelected));
  }
  els.board.classList.toggle('won', won);
  els.board.classList.toggle('busy', phase === 'animating');

  els.night.textContent = state.nights.length;
  if (phase !== 'animating') setStatus(statusText());

  const count = selected.size;
  els.search.disabled = phase !== 'planning' || count === 0;
  els.searchLabel.textContent = count
    ? `Search ${count} ${plural(count, 'coop')}`
    : `Pick up to ${level.searches} ${plural(level.searches, 'coop')}`;
  els.undo.disabled = phase === 'animating' || (!won && state.nights.length < 2);
  els.controls.hidden = won;
  els.win.hidden = !won;
  if (won) renderWin();

  renderMeta();
  renderForecast();
  renderTimeline();
}

function describeCell(cell, isPossible, isSelected) {
  const [row, col] = toRowCol(state.board, cell);
  const where = `Row ${row + 1}, column ${col + 1}`;
  if (isSelected) return `${where}: searching tonight`;
  if (isPossible) return `${where}: the chicken could be here`;
  return `${where}: ruled out`;
}

function statusText() {
  const { level, phase, nights } = state;
  if (phase === 'won') return `<strong>Trapped!</strong> There's nowhere left for it to hide.`;

  const n = tonight().possible.size;
  const where =
    nights.length === 1
      ? `The chicken is hiding in one of these <strong>${n}</strong> coops.`
      : `The chicken could be in <strong>${n}</strong> ${plural(n, 'coop')}.`;
  const ask =
    n <= level.searches
      ? 'You can search every one of them tonight!'
      : `Pick up to <strong>${level.searches}</strong> to search tonight.`;
  return `${where} ${ask}`;
}

function setStatus(html) {
  clearTimeout(nudgeTimer);
  els.status.classList.remove('nudge');
  els.status.innerHTML = html;
}

// A short-lived message, e.g. when a click can't do anything.
function nudge(html) {
  setStatus(html);
  void els.status.offsetWidth; // restart the animation
  els.status.classList.add('nudge');
  nudgeTimer = setTimeout(() => {
    if (state.phase !== 'animating') setStatus(statusText());
  }, 3000);
}

function renderMeta() {
  const { level, levelIndex } = state;
  const piece = PIECES[level.piece];
  const best = saved.best[levelIndex + 1];

  els.levelNumber.textContent = levelIndex + 1;
  els.levelName.textContent = level.name;
  els.levelMeta.innerHTML = `
    <li><img class="chip-icon" data-piece="${level.piece}" src="${piece.image}" alt=""> ${piece.name}</li>
    <li>${ICONS.search} ${level.searches} ${plural(level.searches, 'search', 'searches')} a night</li>
    <li>${ICONS.flag} Par: ${level.par} nights</li>
    ${best ? `<li class="chip-best">${ICONS.check} Your best: ${best}</li>` : ''}`;
}

function renderPiece() {
  const piece = PIECES[state.level.piece];
  const demo = parseLayout(['ooooo', 'ooooo', 'ooooo', 'ooooo', 'ooooo']);
  const center = 12;
  const mini = miniBoard(demo, { possible: new Set(movesFrom(demo, state.level.piece, center)) });
  mini.classList.add('pattern');
  mini.children[center].classList.add('origin');
  mini.children[center].innerHTML = `<img src="${piece.image}" alt="" data-piece="${state.level.piece}">`;

  els.movesDiagram.replaceChildren(mini);
  els.movesTitle.textContent = `How the ${piece.name.toLowerCase()} moves`;
  els.movesRule.textContent = piece.rule;
}

function renderLevelList() {
  els.levelList.replaceChildren(
    ...LEVELS.map((level, i) => {
      const best = saved.best[i + 1];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'level-pill';
      button.dataset.level = i;
      button.title = level.name;
      button.classList.toggle('done', Boolean(best));
      if (i === state.levelIndex) button.setAttribute('aria-current', 'page');
      button.setAttribute('aria-label', `Level ${i + 1}: ${level.name}${best ? `, solved in ${best} nights` : ''}`);
      button.innerHTML = `
        ${level.piece === 'chicken' ? '' : `<img src="${PIECES[level.piece].image}" alt="" data-piece="${level.piece}">`}
        <span>${i + 1}</span>
        ${best ? ICONS.check : ''}`;

      const item = document.createElement('li');
      item.append(button);
      return item;
    }),
  );

  const current = els.levelList.querySelector('[aria-current]');
  els.levelList.scrollTo({
    left: current.offsetLeft - els.levelList.clientWidth / 2 + current.offsetWidth / 2,
    behavior: 'smooth',
  });
}

function renderForecast() {
  els.forecastCard.hidden = !saved.settings.forecast;
  if (!saved.settings.forecast) return;

  const { board, level, selected, phase } = state;
  const { possible } = tonight();

  if (phase === 'won') {
    els.forecastBoard.replaceChildren(miniBoard(board, { found: state.found }));
    els.forecastText.innerHTML = 'Caught! There is no tomorrow for this chicken.';
    return;
  }

  const forecast = playNight(board, level.piece, possible, selected);
  const n = forecast.next.size;
  els.forecastBoard.replaceChildren(miniBoard(board, { possible: forecast.next }));

  if (forecast.caught) {
    els.forecastText.innerHTML = '<strong>This search is sure to catch it!</strong>';
  } else if (selected.size === 0) {
    els.forecastText.innerHTML = `Without a search, it could be in <strong>${n}</strong> ${plural(n, 'coop')}
      tomorrow. Pick coops to see how that changes.`;
  } else {
    const change = n < possible.size ? `down from ${possible.size}` : n > possible.size ? `up from ${possible.size}` : 'same as today';
    els.forecastText.innerHTML = `After this search, it could be in <strong>${n}</strong> ${plural(n, 'coop')}
      tomorrow (${change}).`;
  }
}

function renderTimeline() {
  const { board, nights, phase } = state;
  const won = phase === 'won';

  const items = nights.map((night, i) => {
    const isTonight = i === nights.length - 1 && !won;
    const searched = isTonight ? state.selected : night.searched;
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'thumb';
    thumb.dataset.night = i;
    thumb.disabled = isTonight || phase === 'animating';
    thumb.setAttribute('aria-label', isTonight ? `Tonight: ${night.possible.size} possible coops` : `Go back to night ${i + 1}`);
    if (isTonight) thumb.setAttribute('aria-current', 'step');
    thumb.append(miniBoard(board, { possible: night.possible, searched }));
    thumb.insertAdjacentHTML(
      'beforeend',
      `<span class="thumb-label">${isTonight ? 'Tonight' : `Night ${i + 1}`}</span>
       <span class="thumb-count">${night.possible.size} ${plural(night.possible.size, 'coop')}</span>`,
    );
    const item = document.createElement('li');
    item.append(thumb);
    return item;
  });

  if (won) {
    const item = document.createElement('li');
    item.innerHTML = `<div class="thumb thumb-caught"></div>`;
    item.firstChild.append(miniBoard(board, { found: state.found }));
    item.firstChild.insertAdjacentHTML('beforeend', '<span class="thumb-label">Caught!</span><span class="thumb-count">0 coops</span>');
    items.push(item);
  }

  els.timeline.replaceChildren(...items);
  els.timeline.scrollTo({ left: els.timeline.scrollWidth, behavior: 'smooth' });
}

function renderWin() {
  const { level, levelIndex } = state;
  const nights = state.nights.length;
  const isLast = levelIndex === LEVELS.length - 1;

  els.winTitle.textContent = `Trapped in ${nights} ${plural(nights, 'night')}!`;
  els.winText.textContent =
    nights <= level.par
      ? "That's par: the fewest nights possible. Nicely done!"
      : `Par is ${level.par} nights. Can you catch it faster?`;
  if (isLast) els.winText.textContent += ' That was the last level.';
  els.next.hidden = isLast;
}

function miniBoard(board, { possible = new Set(), searched = null, found = null } = {}) {
  const grid = document.createElement('div');
  grid.className = 'mini';
  grid.style.setProperty('--cols', board.cols);

  for (let cell = 0; cell < board.rows * board.cols; cell++) {
    const square = document.createElement('span');
    if (board.coops.has(cell)) {
      square.className = 'mini-coop';
      square.classList.toggle('possible', possible.has(cell));
      square.classList.toggle('searched', Boolean(searched?.has(cell)));
      square.classList.toggle('found', Boolean(found?.has(cell)));
    } else {
      square.className = 'mini-gap';
    }
    grid.append(square);
  }

  return grid;
}

// ---------- Move hints and arrows ----------

function showHints(cell) {
  if (state.phase === 'animating') return;
  clearHints();
  cellEls.get(cell).classList.add('hint-source');
  for (const to of movesFrom(state.board, state.level.piece, cell)) cellEls.get(to).classList.add('hint');
}

function clearHints() {
  for (const el of cellEls.values()) el.classList.remove('hint', 'hint-source');
}

function drawArrows(moves, animate) {
  arrowMoves = moves;
  const wrap = els.boardWrap.getBoundingClientRect();
  const centerOf = (cell) => {
    const box = cellEls.get(cell).getBoundingClientRect();
    return { x: box.left - wrap.left + box.width / 2, y: box.top - wrap.top + box.height / 2, size: box.width };
  };

  // Stagger arrows by where they start, so the spread reads as coming from each coop.
  const sources = [...new Set(moves.map((m) => m.from))];
  const stagger = Math.min(70, 350 / sources.length);
  // Knight and rooster boards can have 60+ moves, so draw those finer.
  const dense = moves.length > 24;

  const arrows = moves.map(({ from, to }) => {
    const a = centerOf(from);
    const b = centerOf(to);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    const inset = a.size * 0.3;
    const lane = a.size * (dense ? 0.04 : 0.08); // A->B and B->A run side by side instead of overlapping
    const head = a.size * (dense ? 0.09 : 0.12);

    const x1 = a.x + ux * inset - uy * lane;
    const y1 = a.y + uy * inset + ux * lane;
    const tipX = b.x - ux * inset - uy * lane;
    const tipY = b.y - uy * inset + ux * lane;
    const baseX = tipX - ux * head;
    const baseY = tipY - uy * head;
    const wing = head * 0.6;
    const points = [
      [tipX, tipY],
      [baseX - uy * wing, baseY + ux * wing],
      [baseX + uy * wing, baseY - ux * wing],
    ];

    const delay = Math.round(sources.indexOf(from) * stagger);
    return `<g class="trail" style="--len:${(length - inset * 2 - head).toFixed(1)};--delay:${delay}ms">
      <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${baseX.toFixed(1)}" y2="${baseY.toFixed(1)}"/>
      <polygon points="${points.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}"/>
    </g>`;
  });

  els.arrows.setAttribute('viewBox', `0 0 ${wrap.width} ${wrap.height}`);
  const cellSize = centerOf(moves[0].from).size;
  els.arrows.style.setProperty('--stroke', `${Math.max(dense ? 1.5 : 2, cellSize * (dense ? 0.018 : 0.035))}px`);
  els.arrows.classList.toggle('dense', dense);
  els.arrows.classList.toggle('static', !animate);
  els.arrows.classList.remove('faded');
  els.arrows.innerHTML = arrows.join('');
}

function clearArrows() {
  arrowMoves = null;
  els.arrows.innerHTML = '';
}

// ---------- Playing a night ----------

function toggleCell(cell) {
  if (state.phase !== 'planning') return;
  const { selected, level } = state;
  clearArrows();

  if (selected.has(cell)) {
    selected.delete(cell);
  } else if (!tonight().possible.has(cell)) {
    return nudge("That coop is already ruled out. The chicken can't be there tonight.");
  } else if (selected.size >= level.searches) {
    return nudge(
      `You can only search ${level.searches} ${plural(level.searches, 'coop')} a night. Tap a picked coop to swap it.`,
    );
  } else {
    selected.add(cell);
  }
  render();

  if (saved.settings.autoSearch && selected.size === level.searches) {
    const myRun = run;
    setTimeout(() => {
      if (myRun === run && state.phase === 'planning' && state.selected.size === level.searches) playTonight();
    }, 400);
  }
}

async function playTonight() {
  if (state.phase !== 'planning' || state.selected.size === 0) return;

  const myRun = run;
  const animate = saved.settings.animate && !reducedMotion.matches;
  // Waits between steps, and reports whether we should keep going.
  const step = async (ms) => {
    if (animate) await wait(ms);
    return myRun === run;
  };

  const { board, level } = state;
  const { possible } = tonight();
  const searched = new Set(state.selected);
  const result = playNight(board, level.piece, possible, searched);
  const cellsOf = (set) => [...set].map((cell) => cellEls.get(cell));

  state.phase = 'animating';
  clearHints();
  clearArrows();
  render();

  // 1. Shine a light into each searched coop.
  setStatus(`Searching ${searched.size} ${plural(searched.size, 'coop')}…`);
  cellsOf(searched).forEach((el) => el.classList.add('searching'));
  if (!(await step(550))) return;

  if (result.survivors.size === 0) {
    // Every place it could have been was searched, so one of them had the chicken.
    cellsOf(searched).forEach((el) => el.classList.remove('searching', 'selected'));
    return finishNight(searched, result, possible);
  }

  cellsOf(searched).forEach((el) => {
    el.classList.remove('searching', 'selected', 'possible');
    el.classList.add('stamp');
  });
  const left = result.survivors.size;
  setStatus(`Empty! So it must be in one of the other <strong>${left}</strong> ${plural(left, 'coop')}.`);
  if (!(await step(800))) return;

  // 2. The chicken leaves its coop, and could go anywhere its moves allow.
  setStatus(`The chicken has to move. Here's everywhere it could go…`);
  cellsOf(result.survivors).forEach((el) => el.classList.add('leaving'));
  if (result.moves.length) drawArrows(result.moves, animate);
  if (!(await step(1000))) return;

  // 3. It lands somewhere new.
  for (const [cell, el] of cellEls) {
    el.classList.remove('leaving', 'stamp');
    el.classList.toggle('possible', result.next.has(cell));
    el.classList.toggle('arrived', result.next.has(cell));
  }
  els.arrows.classList.add('faded');
  if (!(await step(450))) return;

  finishNight(searched, result, possible);
}

function finishNight(searched, result, possible) {
  const last = state.nights.length - 1;
  state.nights = state.nights.map((night, i) => (i === last ? { ...night, searched } : night));
  state.selected = new Set();

  if (result.caught) {
    state.phase = 'won';
    // It was in one of the searched coops, or (if it had nowhere to move) where it got stuck.
    state.found = result.survivors.size ? result.survivors : new Set([...searched].filter((c) => possible.has(c)));
    clearArrows();

    const key = state.levelIndex + 1;
    if (!saved.best[key] || state.nights.length < saved.best[key]) saved.best[key] = state.nights.length;
    persist();
    renderLevelList();
  } else {
    state.nights.push({ possible: result.next, searched: null });
    state.phase = 'planning';
  }

  render();
}

function rewindTo(index) {
  if (state.phase === 'animating') return;
  const night = state.nights[index];
  state.nights = [...state.nights.slice(0, index), { possible: night.possible, searched: null }];
  state.selected = new Set(night.searched ?? []);
  state.phase = 'planning';
  state.found = new Set();
  clearArrows();
  render();
}

function undo() {
  if (state.phase === 'animating') return;
  // After a win, tonight's search is the one to take back; otherwise go back a night.
  const index = state.phase === 'won' ? state.nights.length - 1 : state.nights.length - 2;
  if (index >= 0) rewindTo(index);
}

// ---------- Events ----------

els.board.addEventListener('click', (event) => {
  const coop = event.target.closest('.coop');
  if (!coop) return;
  focusCell(Number(coop.dataset.cell), false);
  toggleCell(Number(coop.dataset.cell));
});

els.board.addEventListener('pointerover', (event) => {
  const coop = event.target.closest('.coop');
  if (coop && event.pointerType === 'mouse') showHints(Number(coop.dataset.cell));
});
els.board.addEventListener('pointerleave', clearHints);
els.board.addEventListener('focusin', (event) => {
  if (event.target.matches('.coop:focus-visible')) showHints(Number(event.target.dataset.cell));
});
els.board.addEventListener('focusout', clearHints);

// Arrow keys move between coops, skipping empty ground.
els.board.addEventListener('keydown', (event) => {
  const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
  const coop = event.target.closest('.coop');
  if (!step || !coop) return;
  event.preventDefault();

  const { rows, cols } = state.board;
  let [row, col] = toRowCol(state.board, Number(coop.dataset.cell));
  for (row += step[0], col += step[1]; row >= 0 && row < rows && col >= 0 && col < cols; row += step[0], col += step[1]) {
    if (cellEls.has(row * cols + col)) return focusCell(row * cols + col, true);
  }
});

function focusCell(cell, moveFocus) {
  for (const [index, el] of cellEls) el.tabIndex = index === cell ? 0 : -1;
  if (moveFocus) cellEls.get(cell).focus();
}

els.search.addEventListener('click', playTonight);
els.undo.addEventListener('click', undo);
els.restart.addEventListener('click', () => startLevel(state.levelIndex));
els.replay.addEventListener('click', () => startLevel(state.levelIndex));
els.next.addEventListener('click', () => startLevel(Math.min(state.levelIndex + 1, LEVELS.length - 1)));

els.levelList.addEventListener('click', (event) => {
  const pill = event.target.closest('.level-pill');
  if (pill) startLevel(Number(pill.dataset.level));
});

els.timeline.addEventListener('click', (event) => {
  const thumb = event.target.closest('button.thumb');
  if (thumb && !thumb.disabled) rewindTo(Number(thumb.dataset.night));
});

for (const input of document.querySelectorAll('[data-setting]')) {
  input.checked = saved.settings[input.dataset.setting];
  input.addEventListener('change', () => {
    saved.settings[input.dataset.setting] = input.checked;
    persist();
    renderForecast();
  });
}

els.helpBtn.addEventListener('click', () => els.help.showModal());
els.help.addEventListener('click', (event) => {
  if (event.target === els.help) els.help.close(); // clicked the backdrop
});
els.help.addEventListener('close', () => {
  saved.seenHelp = true;
  persist();
});

window.addEventListener('hashchange', () => {
  const index = levelFromHash();
  if (index !== null && index !== state.levelIndex) startLevel(index);
});

new ResizeObserver(() => {
  if (!arrowMoves) return;
  const faded = els.arrows.classList.contains('faded');
  drawArrows(arrowMoves, false);
  els.arrows.classList.toggle('faded', faded);
}).observe(els.boardWrap);

// ---------- Start ----------

const firstUnsolved = LEVELS.findIndex((_, i) => !saved.best[i + 1]);
startLevel(levelFromHash() ?? Math.max(firstUnsolved, 0));
if (!saved.seenHelp) els.help.showModal();
