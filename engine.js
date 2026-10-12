/* Ludo Royal - moteur de règles (pur, sans DOM). Utilisable dans le navigateur et dans Node. */
(function (root) {
  'use strict';
  // Couleurs : 0 Rouge (haut-gauche), 1 Vert (haut-droite), 2 Jaune (bas-droite), 3 Bleu (bas-gauche)
  const START = [0, 13, 26, 39];
  const SAFE = new Set([0, 13, 26, 39, 8, 21, 34, 47]); // départs + étoiles
  const STAR_CELLS = [8, 21, 34, 47];

  // Chemin de 52 cases (col,ligne) sur une grille 15x15, sens horaire à partir du départ rouge.
  const PATH = [];
  function seg(x, y, dx, dy, n) { for (let i = 0; i < n; i++) PATH.push([x + dx * i, y + dy * i]); }
  seg(1, 6, 1, 0, 5); seg(6, 5, 0, -1, 6); seg(7, 0, 1, 0, 2); seg(8, 1, 0, 1, 5);
  seg(9, 6, 1, 0, 6); seg(14, 7, 0, 1, 2); seg(13, 8, -1, 0, 5); seg(8, 9, 0, 1, 6);
  seg(7, 14, -1, 0, 2); seg(6, 13, 0, -1, 5); seg(5, 8, -1, 0, 6); seg(0, 7, 0, -1, 2);

  // Colonnes d'arrivée (5 cases) menant au centre.
  const HOMECOL = [
    [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
    [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
    [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  ];
  const ORIGIN = [[0, 0], [9, 0], [9, 9], [0, 9]];
  const SPOTS = [[2, 2], [4, 2], [2, 4], [4, 4]];
  const CENTER = [[6.75, 7.5], [7.5, 6.75], [8.25, 7.5], [7.5, 8.25]];

  // Position d'un pion : -1 = base, 0..50 = piste, 51..55 = colonne finale, 56 = arrivé.
  function absCell(color, pos) { return (START[color] + pos) % 52; }
  function posXY(color, pos, tok, ntok) {
    if (pos === -1) {
      const o = ORIGIN[color]; const p = ntok === 1 ? [3, 3] : SPOTS[tok];
      return [o[0] + p[0], o[1] + p[1]];
    }
    if (pos <= 50) { const c = PATH[absCell(color, pos)]; return [c[0] + 0.5, c[1] + 0.5]; }
    if (pos <= 55) { const h = HOMECOL[color][pos - 51]; return [h[0] + 0.5, h[1] + 0.5]; }
    const c = CENTER[color]; const off = (tok - (ntok - 1) / 2) * 0.18;
    return color % 2 === 0 ? [c[0], c[1] + off] : [c[0] + off, c[1]];
  }

  function newState(colors, ntok) {
    const n = colors.length;
    return {
      colors: colors.slice(), n, tokens: ntok,
      pos: colors.map(() => Array(ntok).fill(-1)),
      turn: 0, dice: 0, phase: 'roll', sixes: 0, movable: [], rank: [], over: false,
    };
  }

  function rollDie() { return 1 + Math.floor(Math.random() * 6); }

  function legal(st, s, roll) {
    const out = [];
    for (let t = 0; t < st.tokens; t++) {
      const p = st.pos[s][t];
      if (p === -1) { if (roll === 6) out.push(t); }
      else if (p < 56 && p + roll <= 56) out.push(t);
    }
    return out;
  }

  function passTurn(st) {
    st.sixes = 0; st.phase = 'roll'; st.movable = [];
    let next = st.turn;
    for (let i = 0; i < st.n; i++) {
      next = (next + 1) % st.n;
      if (!st.rank.includes(next)) break;
    }
    st.turn = next;
  }

  function applyRoll(st, val) {
    const s = st.turn, ev = [{ t: 'roll', seat: s, val }];
    st.dice = val; st.sixes = val === 6 ? st.sixes + 1 : 0;
    if (st.sixes === 3) { ev.push({ t: 'triple', seat: s }); passTurn(st); return ev; }
    st.movable = legal(st, s, val);
    if (!st.movable.length) { ev.push({ t: 'nomove', seat: s }); passTurn(st); return ev; }
    st.phase = 'move';
    return ev;
  }

  function applyReroll(st, val) { // relance payée en diamants
    if (st.phase !== 'move') return [];
    if (st.dice === 6) st.sixes = Math.max(0, st.sixes - 1);
    return applyRoll(st, val === undefined ? rollDie() : val);
  }

  function applyMove(st, tok) {
    const s = st.turn, c = st.colors[s], ev = [];
    const from = st.pos[s][tok];
    const to = from === -1 ? 0 : from + st.dice;
    st.pos[s][tok] = to;
    ev.push({ t: 'move', seat: s, tok, from, to });
    let bonus = st.dice === 6;
    if (to <= 50) {
      const a = absCell(c, to);
      if (!SAFE.has(a)) {
        for (let o = 0; o < st.n; o++) {
          if (o === s) continue;
          const oc = st.colors[o];
          for (let k = 0; k < st.tokens; k++) {
            const p = st.pos[o][k];
            if (p >= 0 && p <= 50 && absCell(oc, p) === a) {
              st.pos[o][k] = -1;
              ev.push({ t: 'capture', seat: o, tok: k, by: s, from: p, at: a });
              bonus = true;
            }
          }
        }
      }
    }
    if (to === 56) {
      ev.push({ t: 'home', seat: s, tok }); bonus = true;
      if (st.pos[s].every(p => p === 56)) { st.rank.push(s); ev.push({ t: 'win', seat: s, place: st.rank.length }); }
    }
    st.movable = []; st.phase = 'roll';
    const left = [];
    for (let i = 0; i < st.n; i++) if (!st.rank.includes(i)) left.push(i);
    if (left.length <= 1) {
      if (left.length === 1) st.rank.push(left[0]);
      st.over = true; st.phase = 'over'; ev.push({ t: 'over' });
      return ev;
    }
    if (!(bonus && !st.rank.includes(s))) passTurn(st);
    return ev;
  }

  // ---------- IA simple mais correcte ----------
  function threatened(st, s, abs) {
    if (SAFE.has(abs)) return 0;
    let n = 0;
    for (let o = 0; o < st.n; o++) {
      if (o === s) continue;
      for (let k = 0; k < st.tokens; k++) {
        const p = st.pos[o][k];
        if (p < 0 || p > 50) continue;
        const d = (abs - absCell(st.colors[o], p) + 52) % 52;
        if (d >= 1 && d <= 6) n++;
      }
    }
    return n;
  }
  function aiPick(st) {
    const s = st.turn, c = st.colors[s];
    let best = st.movable[0], bestScore = -1e9;
    for (const t of st.movable) {
      const from = st.pos[s][t], to = from === -1 ? 0 : from + st.dice;
      let sc = to * 0.3 + Math.random() * 2;
      if (to === 56) sc += 100;
      if (from === -1) sc += 50;
      if (to >= 51) sc += 35;
      if (to <= 50) {
        const a = absCell(c, to);
        if (SAFE.has(a)) sc += 30;
        sc -= 30 * threatened(st, s, a);
        if (!SAFE.has(a)) {
          for (let o = 0; o < st.n; o++) {
            if (o === s) continue;
            for (let k = 0; k < st.tokens; k++) {
              const p = st.pos[o][k];
              if (p >= 0 && p <= 50 && absCell(st.colors[o], p) === a) sc += 80 + p;
            }
          }
        }
      }
      if (from >= 0 && from <= 50) sc += 25 * Math.min(1, threatened(st, s, absCell(c, from)));
      if (sc > bestScore) { bestScore = sc; best = t; }
    }
    return best;
  }
  // Si tous les coups mènent au même endroit, on peut jouer automatiquement.
  function singleChoice(st) {
    const s = st.turn, set = new Set(st.movable.map(t => st.pos[s][t]));
    return set.size === 1 ? st.movable[0] : -1;
  }

  const api = { START, SAFE, STAR_CELLS, PATH, HOMECOL, ORIGIN, SPOTS, CENTER, posXY, absCell, newState, rollDie, legal, passTurn, applyRoll, applyReroll, applyMove, aiPick, singleChoice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Ludo = api;
})(typeof window !== 'undefined' ? window : globalThis);
