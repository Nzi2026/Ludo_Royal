/* Ludo Royal - interface, boucle de jeu, en ligne (PeerJS), boutique. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const L = window.Ludo, FX = window.AudioFX;
  const COLORS = ['#e53935', '#43a047', '#fdd835', '#1e88e5'];
  const LIGHT = ['#ff9e98', '#b4e0b6', '#fff9c4', '#a6d3fb'];
  const DARK = ['#8e1b19', '#1f6b24', '#b89b00', '#0d4f8f'];
  const CN = ['Rouge', 'Vert', 'Jaune', 'Bleu'];
  const THEMES = {
    classic: { name: 'Classique', price: 0, frame: '#ffffff', cell: '#ffffff', line: '#9aa3c7', inner: '#ffffffd9' },
    nature: { name: 'Nature', price: 200, frame: '#aed581', cell: '#f1f8e9', line: '#7cb342', inner: '#f1f8e9d9' },
    candy: { name: 'Bonbon', price: 400, frame: '#f8bbd0', cell: '#fff0f6', line: '#ec7fa3', inner: '#fff0f6d9' },
    night: { name: 'Nuit', price: 600, frame: '#1c262b', cell: '#3b4a52', line: '#78909c', inner: '#3b4a52d9' },
  };
  const EMOJIS = ['😂', '😍', '🍅', '🥂', '😡', '👏'];
  const PREFIX = 'ludoroyal-';

  // ---------- sauvegarde ----------
  let S = { coins: 100, gems: 5, theme: 'classic', owned: ['classic'], music: true, sfx: true, games: 0 };
  try { Object.assign(S, JSON.parse(localStorage.getItem('ludoroyal') || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem('ludoroyal', JSON.stringify(S)); } catch (e) {} };
  const clone = o => JSON.parse(JSON.stringify(o));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function wallet() { $('#coins').textContent = '🪙 ' + S.coins; $('#gems').textContent = '💎 ' + S.gems; $('#gems2').textContent = '💎 ' + S.gems; }
  FX.setMusic(S.music); FX.setSfx(S.sfx);

  // ---------- écrans & fenêtres ----------
  function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id)); }
  function modal(html, mount) { $('#modalCard').innerHTML = html; $('#modal').classList.add('show'); mount && mount($('#modalCard')); }
  function closeModal() { $('#modal').classList.remove('show'); }
  function opts(root, sel, cb) {
    root.querySelectorAll(sel + ' .opt').forEach(b => b.onclick = () => {
      root.querySelectorAll(sel + ' .opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); cb(b.dataset.v);
    });
  }

  // ---------- partie ----------
  let G = null, raf = 0, last = 0;
  const isBusy = () => !!G && (G.pending > 0 || G.waiting);
  const seatName = i => G.cfg.names[i];
  function canControl(seat) {
    const c = G.cfg;
    return c.mySeat == null ? c.kinds[seat] === 'human' : seat === c.mySeat;
  }

  function startGame(cfg) {
    closeModal(); show('game');
    const st = L.newState(cfg.colors, cfg.ntok);
    G = { cfg, st, shown: clone(st), vpos: clone(st.pos), ov: new Map(), pending: 0, waiting: false, chain: Promise.resolve(),
      diceVal: 0, parts: [], ended: false, paused: false, hit: [], cache: null, cacheKey: '', dt: 0 };
    buildHUD(); resize(); setDice(0); updateHUD(); Ads.banner($('#bannerGame'));
    if (!raf) raf = requestAnimationFrame(loop);
    if (cfg.online !== 'guest') drive();
  }
  function quitToMenu() {
    if (G) { clearTimeout(G.dt); G.ended = true; }
    G = null; Net.close(); closeModal(); show('menu'); wallet(); Ads.banner($('#bannerMenu'));
  }

  function buildHUD() {
    const box = $('#players'); box.innerHTML = '';
    G.cfg.colors.forEach((c, i) => {
      const d = document.createElement('div'); d.className = 'chip'; d.id = 'chip' + i;
      d.innerHTML = '<i style="background:' + COLORS[c] + '"></i><span>' + G.cfg.names[i] + '</span><small></small>';
      box.appendChild(d);
    });
    const em = $('#emojis'); em.innerHTML = '';
    EMOJIS.forEach(e => { const b = document.createElement('button'); b.textContent = e; b.onclick = () => sendEmoji(e); em.appendChild(b); });
    $('#btnReroll').hidden = true;
  }
  function setDice(v) {
    const d = $('#dice'); const P = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[v];
    d.innerHTML = ''; for (let i = 0; i < 9; i++) { const s = document.createElement('span'); if (P.includes(i)) s.className = 'on'; d.appendChild(s); }
  }
  function curColorVar(seat) { document.documentElement.style.setProperty('--cur', COLORS[G.cfg.colors[seat]]); }
  function say(t) { $('#status').textContent = t; }

  function updateHUD() {
    if (!G) return;
    const sh = G.shown, seat = sh.turn, busy = isBusy();
    curColorVar(seat);
    G.cfg.colors.forEach((c, i) => {
      const ch = $('#chip' + i); if (!ch) return;
      const home = sh.pos[i].filter(p => p === 56).length;
      const place = sh.rank.indexOf(i);
      ch.classList.toggle('on', i === seat && !sh.over); ch.classList.toggle('out', place >= 0);
      ch.querySelector('small').textContent = place >= 0 ? ['🥇', '🥈', '🥉', '4e'][place] : '🏠' + home + '/' + sh.tokens;
    });
    const mine = canControl(seat);
    $('#dice').classList.toggle('ready', !busy && !sh.over && sh.phase === 'roll' && mine);
    if (!busy) {
      if (sh.over) say('Partie terminée');
      else if (sh.phase === 'roll') say(mine ? '🎲 ' + seatName(seat) + ', lancez le dé !' : seatName(seat) + ' lance le dé…');
      else say(mine ? '👆 Touchez un pion à déplacer' : seatName(seat) + ' réfléchit…');
    }
    const rr = $('#btnReroll');
    rr.hidden = !(G.cfg.online == null && !busy && !sh.over && sh.phase === 'move' && mine);
    wallet();
  }

  // ---------- actions ----------
  function userAct(a) {
    if (!G || isBusy() || G.ended || G.paused) return;
    const sh = G.shown, seat = sh.turn; if (!canControl(seat) || sh.over) return;
    if (a.type === 'roll' && sh.phase !== 'roll') return;
    if (a.type === 'move' && (sh.phase !== 'move' || !sh.movable.includes(a.tok))) return;
    if (a.type === 'reroll' && sh.phase !== 'move') return;
    FX.init();
    if (G.cfg.online === 'guest') {
      G.waiting = true; clearTimeout(G.wt); G.wt = setTimeout(() => { if (G) { G.waiting = false; updateHUD(); } }, 3500);
      Net.send({ k: 'act', a }); updateHUD(); return;
    }
    hostAct(Object.assign({ seat }, a));
  }
  function hostAct(a) {
    const st = G.st; if (st.over || G.pending > 0) return;
    let ev;
    if (a.type === 'roll') { if (st.phase !== 'roll' || st.turn !== a.seat) return; ev = L.applyRoll(st, L.rollDie()); }
    else if (a.type === 'move') { if (st.phase !== 'move' || st.turn !== a.seat || !st.movable.includes(a.tok)) return; ev = L.applyMove(st, a.tok); }
    else if (a.type === 'reroll') { if (st.phase !== 'move' || st.turn !== a.seat) return; ev = L.applyReroll(st); }
    else return;
    const snap = clone(st);
    if (G.cfg.online === 'host') Net.broadcast({ k: 'upd', st: snap, ev });
    enqueue(ev, snap);
  }
  function enqueue(ev, snap) {
    const g = G; g.pending++; g.waiting = false; updateHUD();
    g.chain = g.chain.then(async () => {
      if (G !== g) return;
      try { await playEvents(ev); } catch (e) { console.error(e); }
      if (G !== g) return;
      g.vpos = clone(snap.pos); g.shown = snap; g.ov.clear(); g.pending--; updateHUD();
      if (g.cfg.online !== 'guest') drive(); else if (snap.over) endGame();
    });
  }
  function drive() {
    const g = G; if (!g || g.ended || g.paused) return;
    const st = g.st; if (st.over) { endGame(); return; }
    if (g.pending > 0) return;
    clearTimeout(g.dt);
    if (g.cfg.kinds[st.turn] === 'cpu') {
      g.dt = setTimeout(() => {
        if (G !== g || g.paused) return;
        if (st.phase === 'roll') hostAct({ seat: st.turn, type: 'roll' });
        else hostAct({ seat: st.turn, type: 'move', tok: L.aiPick(st) });
      }, st.phase === 'roll' ? 750 : 500);
    } else if (st.phase === 'move') {
      const t = L.singleChoice(st);
      if (t >= 0) g.dt = setTimeout(() => { if (G === g && !g.paused) hostAct({ seat: st.turn, type: 'move', tok: t }); }, 380);
    }
  }

  // ---------- animations & sons ----------
  function anim(dur, fn) {
    return new Promise(res => {
      let done = false; const t0 = performance.now();
      const fin = () => { if (!done) { done = true; fn(1); res(); } };
      (function f(now) { if (done) return; const k = Math.min(1, (now - t0) / dur); fn(k); if (k < 1) requestAnimationFrame(f); else fin(); })(t0);
      setTimeout(fin, dur + 250);
    });
  }
  function curXY(seat, tok) {
    const o = G.ov.get(seat + '-' + tok); if (o) return [o[0], o[1]];
    return L.posXY(G.cfg.colors[seat], G.vpos[seat][tok], tok, G.cfg.ntok);
  }
  async function hop(seat, tok, toPos, dur) {
    const key = seat + '-' + tok, from = curXY(seat, tok), to = L.posXY(G.cfg.colors[seat], toPos, tok, G.cfg.ntok);
    await anim(dur, k => G.ov.set(key, [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, Math.sin(Math.PI * k) * 0.35]));
    G.vpos[seat][tok] = toPos; G.ov.delete(key);
  }
  function floatAt(x, y, text, color, size) {
    const d = document.createElement('div'); d.className = 'float'; d.textContent = text;
    d.style.left = (x / 15 * 100) + '%'; d.style.top = (y / 15 * 100) + '%'; d.style.color = color || '#fff'; if (size) d.style.fontSize = size + 'px';
    $('#floats').appendChild(d); setTimeout(() => d.remove(), 1700);
  }
  function burst(x, y, n, colors) {
    for (let i = 0; i < n; i++) G.parts.push({ x, y, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 8 - 2, life: 1.2 + Math.random() * 0.6, c: colors[i % colors.length] });
  }
  async function playEvents(ev) {
    for (const e of ev) {
      if (e.t === 'roll') {
        curColorVar(e.seat); const d = $('#dice'); d.classList.remove('ready'); d.classList.add('rolling'); FX.dice();
        const iv = setInterval(() => setDice(1 + Math.floor(Math.random() * 6)), 90);
        say(seatName(e.seat) + ' lance le dé…'); await sleep(650); clearInterval(iv); d.classList.remove('rolling'); setDice(e.val); G.diceVal = e.val; await sleep(250);
      } else if (e.t === 'triple') { say('Trois 6 de suite : tour annulé ! ✋'); FX.fail(); await sleep(1000); }
      else if (e.t === 'nomove') { say('Aucun pion ne peut bouger'); await sleep(800); }
      else if (e.t === 'move') {
        if (e.from === -1) { FX.step(); await hop(e.seat, e.tok, 0, 240); }
        else for (let p = e.from + 1; p <= e.to; p++) { FX.step(); await hop(e.seat, e.tok, p, 125); }
      } else if (e.t === 'capture') {
        FX.laugh(); if (navigator.vibrate) { try { navigator.vibrate(180); } catch (x) {} }
        const [x, y] = curXY(e.seat, e.tok);
        floatAt(x, y, '😈 Ha ha ha !', '#fff', 24); burst(x, y, 24, [COLORS[G.cfg.colors[e.by]], '#fff']);
        const key = e.seat + '-' + e.tok, to = L.posXY(G.cfg.colors[e.seat], -1, e.tok, G.cfg.ntok);
        await anim(600, k => G.ov.set(key, [x + (to[0] - x) * k, y + (to[1] - y) * k, Math.sin(Math.PI * k) * 1.2]));
        G.vpos[e.seat][e.tok] = -1; G.ov.delete(key); await sleep(650);
      } else if (e.t === 'home') {
        FX.home(); const c = G.cfg.colors[e.seat]; const p = L.posXY(c, 56, e.tok, G.cfg.ntok);
        burst(p[0], p[1], 30, [COLORS[c], '#fff', '#ffd166']); floatAt(7.5, 7.5, '🏠 Arrivé !', '#fff', 24); await sleep(550);
      } else if (e.t === 'win') {
        FX.win(); burst(7.5, 7.5, 70, COLORS.concat(['#fff'])); say('🏆 ' + seatName(e.seat) + ' termine ' + (e.place === 1 ? '1er' : e.place + 'e') + ' !'); await sleep(1300);
      }
    }
  }

  // ---------- fin de partie ----------
  function endGame() {
    const g = G; if (!g || g.ended) return; g.ended = true;
    const rank = (g.cfg.online === 'guest' ? g.shown : g.st).rank;
    const medals = ['🥇', '🥈', '🥉', '4️⃣'];
    let reward = '';
    if (g.cfg.online == null && g.cfg.mySeat != null) {
      const won = rank[0] === g.cfg.mySeat; const c = won ? 50 : 10; S.coins += c; reward = '<p class="muted">+' + c + ' 🪙 ' + (won ? 'Victoire !' : 'Participation') + '</p>';
    }
    S.games++; save(); wallet();
    const html = '<h3 style="text-align:center">🏆 Classement</h3>' + rank.map((s, i) =>
      '<div class="rank"><span>' + medals[i] + '</span><i style="width:14px;height:14px;border-radius:50%;background:' + COLORS[g.cfg.colors[s]] + '"></i>' + g.cfg.names[s] + '</div>').join('') + reward +
      '<div class="opts" style="margin-top:14px">' + (g.cfg.online ? '' : '<button class="btn" id="again">🔁 Rejouer</button>') + '<button class="btn ghost" id="toMenu">Menu</button></div>';
    const showIt = () => modal(html, m => {
      const a = m.querySelector('#again'); if (a) a.onclick = () => startGame(g.cfg);
      m.querySelector('#toMenu').onclick = quitToMenu;
    });
    setTimeout(() => {
      if (G !== g) return;
      if (S.games % ADS.interstitialEvery === 0) Ads.interstitial(showIt); else showIt();
    }, 900);
  }

  // ---------- rendu ----------
  function resize() {
    if (!G) return;
    const size = Math.max(250, Math.min(innerWidth - 24, 700, innerHeight - 290));
    const cv = $('#board'), dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.style.width = cv.style.height = size + 'px'; $('#boardWrap').style.width = size + 'px';
    cv.width = cv.height = Math.round(size * dpr); G.cache = null;
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function star(c, x, y, R, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    c.closePath();
  }
  function buildCache(px) {
    const T = THEMES[S.theme], off = document.createElement('canvas'); off.width = off.height = px;
    const c = off.getContext('2d'); c.scale(px / 15, px / 15);
    c.fillStyle = T.frame; c.fillRect(0, 0, 15, 15);
    for (let k = 0; k < 4; k++) {
      const [ox, oy] = L.ORIGIN[k]; c.fillStyle = COLORS[k]; c.fillRect(ox, oy, 6, 6);
      c.fillStyle = T.inner; rr(c, ox + 1, oy + 1, 4, 4, 0.6); c.fill();
      c.fillStyle = COLORS[k] + '55'; L.SPOTS.forEach(([sx, sy]) => { c.beginPath(); c.arc(ox + sx, oy + sy, 0.5, 0, 7); c.fill(); });
    }
    c.lineWidth = 0.04; c.strokeStyle = T.line;
    const cell = (x, y, f) => { c.fillStyle = f; c.fillRect(x, y, 1, 1); c.strokeRect(x, y, 1, 1); };
    L.PATH.forEach(([x, y]) => cell(x, y, T.cell));
    for (let k = 0; k < 4; k++) { const s = L.PATH[L.START[k]]; cell(s[0], s[1], COLORS[k]); L.HOMECOL[k].forEach(([x, y]) => cell(x, y, COLORS[k])); }
    c.fillStyle = T.line; L.STAR_CELLS.forEach(i => { const [x, y] = L.PATH[i]; star(c, x + 0.5, y + 0.5, 0.38, 0.17); c.fill(); });
    c.fillStyle = '#fff'; for (let k = 0; k < 4; k++) { const s = L.PATH[L.START[k]]; star(c, s[0] + 0.5, s[1] + 0.5, 0.3, 0.14); c.fill(); }
    const tri = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); };
    tri([[6, 6], [6, 9], [7.5, 7.5]], COLORS[0]); tri([[6, 6], [9, 6], [7.5, 7.5]], COLORS[1]);
    tri([[9, 6], [9, 9], [7.5, 7.5]], COLORS[2]); tri([[6, 9], [9, 9], [7.5, 7.5]], COLORS[3]);
    c.strokeStyle = '#0003'; c.lineWidth = 0.05; c.strokeRect(6, 6, 3, 3);
    return off;
  }
  function drawToken(c, x, y, lift, col, sc, glow, t) {
    const r = 0.38 * sc;
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, y + 0.16, r * 0.9, r * 0.45, 0, 0, 7); c.fill();
    y -= lift;
    if (glow) { c.strokeStyle = 'rgba(255,255,255,' + (0.55 + 0.4 * Math.sin(t * 7)) + ')'; c.lineWidth = 0.11; c.beginPath(); c.arc(x, y, r + 0.13, 0, 7); c.stroke(); }
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, LIGHT[col]); g.addColorStop(0.45, COLORS[col]); g.addColorStop(1, DARK[col]);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.lineWidth = 0.07; c.strokeStyle = '#fff'; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.35, r * 0.2, 0, 7); c.fill();
  }
  function draw(t, dt) {
    const cv = $('#board'); if (!cv || !G || cv.width < 10) return;
    const px = cv.width, key = px + S.theme;
    if (!G.cache || G.cacheKey !== key) { G.cache = buildCache(px); G.cacheKey = key; }
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(G.cache, 0, 0); c.scale(px / 15, px / 15);
    const sh = G.shown, canMove = !isBusy() && sh.phase === 'move' && !sh.over && canControl(sh.turn);
    const mv = canMove ? new Set(sh.movable) : null;
    const items = [];
    for (let s = 0; s < G.cfg.colors.length; s++) for (let k = 0; k < G.cfg.ntok; k++) {
      const o = G.ov.get(s + '-' + k); let x, y, lift = 0;
      if (o) { x = o[0]; y = o[1]; lift = o[2]; } else [x, y] = L.posXY(G.cfg.colors[s], G.vpos[s][k], k, G.cfg.ntok);
      items.push({ s, k, x, y, lift, pos: G.vpos[s][k], ov: !!o, sc: 1, glow: !!(mv && s === sh.turn && mv.has(k)) });
    }
    const groups = new Map();
    items.forEach(i => { if (i.ov || i.pos === -1 || i.pos === 56) return; const kk = i.x.toFixed(2) + ',' + i.y.toFixed(2); if (!groups.has(kk)) groups.set(kk, []); groups.get(kk).push(i); });
    groups.forEach(arr => { if (arr.length > 1) arr.forEach((i, n) => { const a = n / arr.length * Math.PI * 2 + 0.6; i.x += Math.cos(a) * 0.2; i.y += Math.sin(a) * 0.2; i.sc = arr.length > 2 ? 0.62 : 0.72; }); });
    items.sort((a, b) => (a.y + (a.ov ? 5 : 0)) - (b.y + (b.ov ? 5 : 0)));
    G.hit = [];
    items.forEach(i => {
      const bob = i.glow ? 0.07 + 0.07 * Math.sin(t * 8 + i.k) : 0;
      drawToken(c, i.x, i.y, i.lift + bob, G.cfg.colors[i.s], i.sc, i.glow, t);
      if (i.glow) G.hit.push(i);
    });
    // confettis
    for (let i = G.parts.length - 1; i >= 0; i--) {
      const p = G.parts[i]; p.life -= dt; if (p.life <= 0) { G.parts.splice(i, 1); continue; }
      p.vy += 18 * dt; p.x += p.vx * dt; p.y += p.vy * dt; c.globalAlpha = Math.min(1, p.life); c.fillStyle = p.c; c.fillRect(p.x, p.y, 0.2, 0.2);
    }
    c.globalAlpha = 1;
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    try { if (G && !$('#game').classList.contains('hidden')) draw(now / 1000, dt); } catch (e) { console.error(e); }
  }

  // ---------- saisie ----------
  $('#board').addEventListener('pointerdown', e => {
    FX.init(); if (!G || !G.hit.length) return;
    const r = e.target.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 15, y = (e.clientY - r.top) / r.height * 15;
    let best = null, bd = 1.0;
    G.hit.forEach(i => { const d = Math.hypot(i.x - x, i.y - y); if (d < bd) { bd = d; best = i; } });
    if (best) userAct({ type: 'move', tok: best.k });
  });
  $('#dice').addEventListener('pointerdown', () => { FX.init(); userAct({ type: 'roll' }); });
  $('#btnReroll').onclick = () => {
    if (S.gems < 1) { openShop(); return; }
    S.gems--; save(); userAct({ type: 'reroll' });
  };
  function sendEmoji(e) {
    if (!G) return; FX.init(); FX.pop();
    const seat = G.cfg.mySeat != null ? G.cfg.mySeat : G.shown.turn;
    showEmoji(seat, e);
    if (G.cfg.online === 'host') Net.broadcast({ k: 'emo', seat, e });
    if (G.cfg.online === 'guest') Net.send({ k: 'emo', seat, e });
  }
  function showEmoji(seat, e) {
    if (!G) return; const o = L.ORIGIN[G.cfg.colors[seat]]; floatAt(o[0] + 3, o[1] + 3, e, '#fff', 54);
  }
  $('#btnPause').onclick = () => {
    if (!G) return; G.paused = true;
    modal('<h3>Pause</h3>' + toggles() + '<div class="opts" style="margin-top:12px"><button class="btn" id="resume">▶ Reprendre</button><button class="btn ghost" id="quit">Quitter</button></div>', m => {
      bindToggles(m);
      m.querySelector('#resume').onclick = () => { closeModal(); if (G) { G.paused = false; drive(); } };
      m.querySelector('#quit').onclick = quitToMenu;
    });
  };
  addEventListener('resize', resize);

  // ---------- menu / réglages / règles / boutique ----------
  const TITLES = { cpu: '🤖 Contre l\'ordinateur', local: '👨‍👩‍👧 Entre amis', rush: '⚡ Ludo Rush' };
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { FX.init(); const m = b.dataset.mode; m === 'online' ? openOnline() : openSetup(m); });

  function openSetup(mode) {
    const o = { n: mode === 'rush' ? 2 : 4, me: 0 };
    modal('<h3>' + TITLES[mode] + '</h3>' +
      (mode === 'rush' ? '<p class="muted">2 joueurs, 1 seul pion chacun : parties ultra-rapides.</p>' :
        '<label>Nombre de joueurs</label><div class="opts" id="oN">' + [2, 3, 4].map(n => '<button class="opt' + (n === 4 ? ' sel' : '') + '" data-v="' + n + '">' + n + '</button>').join('') + '</div>') +
      (mode === 'local' ? '' : '<label>Votre couleur</label><div class="opts" id="oC">' + COLORS.map((c, i) => '<button class="opt' + (i === 0 ? ' sel' : '') + '" data-v="' + i + '"><span class="dot" style="background:' + c + '"></span>' + CN[i] + '</button>').join('') + '</div>') +
      '<div class="opts"><button class="btn" id="go">▶ Jouer</button><button class="btn ghost" id="cancel">Annuler</button></div>', m => {
        opts(m, '#oN', v => o.n = +v); opts(m, '#oC', v => o.me = +v);
        m.querySelector('#cancel').onclick = closeModal;
        m.querySelector('#go').onclick = () => {
          let colors;
          if (mode === 'local') colors = o.n === 2 ? [0, 2] : o.n === 3 ? [0, 1, 2] : [0, 1, 2, 3];
          else if (o.n === 2) colors = [o.me, (o.me + 2) % 4];
          else if (o.n === 3) colors = [o.me, (o.me + 1) % 4, (o.me + 2) % 4];
          else colors = [0, 1, 2, 3];
          colors.sort((a, b) => a - b);
          const kinds = colors.map(c => mode === 'local' || c === o.me ? 'human' : 'cpu');
          const names = colors.map((c, i) => mode === 'local' ? 'Joueur ' + (i + 1) : c === o.me ? 'Vous' : 'Ordi');
          startGame({ colors, kinds, names, ntok: mode === 'rush' ? 1 : 4, mySeat: mode === 'local' ? null : colors.indexOf(o.me), online: null, mode });
        };
      });
  }
  function toggles() {
    return '<div class="tog"><span>🎵 Musique douce</span><button class="opt ' + (S.music ? 'sel' : '') + '" data-t="music">' + (S.music ? 'Oui' : 'Non') + '</button></div>' +
      '<div class="tog"><span>🔊 Effets sonores (rire…)</span><button class="opt ' + (S.sfx ? 'sel' : '') + '" data-t="sfx">' + (S.sfx ? 'Oui' : 'Non') + '</button></div>';
  }
  function bindToggles(m) {
    m.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      const k = b.dataset.t; S[k] = !S[k]; save(); FX.init();
      k === 'music' ? FX.setMusic(S.music) : FX.setSfx(S.sfx);
      if (k === 'sfx' && S.sfx) FX.laugh();
      b.classList.toggle('sel', S[k]); b.textContent = S[k] ? 'Oui' : 'Non';
    });
  }
  $('#btnSettings').onclick = () => { FX.init(); modal('<h3>⚙️ Réglages</h3>' + toggles() + '<p class="muted">Ludo Royal v1.0 · <a href="privacy.html" style="color:#ffd166">Confidentialité</a></p><button class="btn" id="ok">Fermer</button>', m => { bindToggles(m); m.querySelector('#ok').onclick = closeModal; }); };
  $('#btnHow').onclick = () => modal('<h3>❓ Règles</h3><div class="muted" style="line-height:1.5">' +
    '<p>🎯 <b>But :</b> amener vos 4 pions autour du plateau jusqu\'au centre avant les autres.</p>' +
    '<p>🎲 Il faut un <b>6</b> pour sortir un pion de la base. Un 6 donne un lancer bonus, mais <b>trois 6 de suite</b> annulent le tour.</p>' +
    '<p>😈 Arrêtez-vous sur un pion adverse pour le <b>manger</b> : il retourne en base et vous rejouez.</p>' +
    '<p>⭐ Les cases étoile et les cases de départ sont <b>sûres</b>.</p>' +
    '<p>🏠 Il faut le chiffre <b>exact</b> pour entrer au centre. Arriver au centre donne aussi un lancer bonus.</p>' +
    '<p>💎 Les diamants permettent de relancer un mauvais dé (modes hors ligne).</p></div><button class="btn" id="ok">Compris</button>', m => m.querySelector('#ok').onclick = closeModal);

  function openShop() {
    const render = () => modal('<h3>🛍️ Boutique</h3><div class="muted">🪙 ' + S.coins + ' · 💎 ' + S.gems + '</div>' +
      '<label>Thèmes de plateau</label>' + Object.entries(THEMES).map(([id, t]) =>
        '<div class="shopitem"><div class="swatch" style="background:' + t.frame + '"></div><div style="flex:1"><b>' + t.name + '</b><br><small>' + (t.price ? t.price + ' 🪙' : 'Gratuit') + '</small></div>' +
        (S.owned.includes(id) ? '<button class="btn small ' + (S.theme === id ? '' : 'ghost') + '" data-use="' + id + '">' + (S.theme === id ? '✔ Actif' : 'Utiliser') + '</button>' : '<button class="btn small" data-buy="' + id + '">Acheter</button>') + '</div>').join('') +
      '<label>Diamants</label>' +
      '<div class="shopitem"><div style="flex:1"><b>Vidéo gratuite</b><br><small>+' + ADS.rewardedGems + ' 💎</small></div><button class="btn small" id="vid">▶ Regarder</button></div>' +
      '<div class="shopitem"><div style="flex:1"><b>Pack 50 💎</b><br><small>Paiement sécurisé</small></div><button class="btn small" data-pay="gems50">Acheter</button></div>' +
      '<div class="shopitem"><div style="flex:1"><b>Pack 150 💎</b><br><small>Meilleure offre</small></div><button class="btn small" data-pay="gems150">Acheter</button></div>' +
      '<button class="btn ghost" id="ok" style="margin-top:12px">Fermer</button>', m => {
        m.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { S.theme = b.dataset.use; save(); if (G) G.cache = null; render(); });
        m.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
          const t = THEMES[b.dataset.buy]; if (S.coins < t.price) { b.textContent = 'Pas assez de 🪙'; return; }
          S.coins -= t.price; S.owned.push(b.dataset.buy); S.theme = b.dataset.buy; save(); wallet(); render();
        });
        m.querySelector('#vid').onclick = () => { closeModal(); Ads.rewarded(() => { S.gems += ADS.rewardedGems; save(); wallet(); openShop(); }); };
        m.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => {
          const url = ADS.payLinks[b.dataset.pay];
          if (url) window.open(url, '_blank'); else alert('Paiement non configuré : ajoutez votre lien Stripe/PayPal dans js/ads.js (voir README).');
        });
        m.querySelector('#ok').onclick = closeModal;
      });
    render();
  }
  $('#btnShop').onclick = openShop;

  let deferredInstall = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('#btnInstall').hidden = false; });
  $('#btnInstall').onclick = async () => { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; $('#btnInstall').hidden = true; } };

  // ---------- en ligne (PeerJS : pair-à-pair, sans serveur de jeu à payer) ----------
  const Net = {
    peer: null, conns: [], hostConn: null, code: '',
    load() {
      if (window.Peer) return Promise.resolve();
      return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    },
    send(m) { if (this.hostConn && this.hostConn.open) this.hostConn.send(m); },
    broadcast(m) { this.conns.forEach(c => c.open && c.send(m)); },
    close() { try { this.peer && this.peer.destroy(); } catch (e) {} this.peer = null; this.conns = []; this.hostConn = null; },
  };
  const errCard = msg => modal('<h3>Oups</h3><p class="muted">' + msg + '</p><button class="btn" id="ok">OK</button>', m => m.querySelector('#ok').onclick = openOnline);

  function openOnline() {
    modal('<h3>🌍 En ligne avec des amis</h3><p class="muted">Créez une salle et partagez le code, ou entrez le code d\'un ami. Connexion directe entre téléphones.</p>' +
      '<button class="btn" id="mk" style="width:100%;margin:6px 0">➕ Créer une salle</button>' +
      '<label>Rejoindre avec un code</label><input type="text" id="cd" maxlength="5" placeholder="CODE">' +
      '<div class="opts" style="margin-top:12px"><button class="btn alt" id="jn">Rejoindre</button><button class="btn ghost" id="cl">Annuler</button></div>', m => {
        m.querySelector('#cl').onclick = () => { Net.close(); closeModal(); };
        m.querySelector('#mk').onclick = createRoom;
        m.querySelector('#jn').onclick = () => { const c = m.querySelector('#cd').value.trim().toUpperCase(); if (c.length >= 4) joinRoom(c); };
      });
  }
  async function createRoom() {
    modal('<h3>Salle privée</h3><p class="muted">Connexion…</p>');
    try { await Net.load(); } catch (e) { return errCard('Impossible de charger le module en ligne. Vérifiez votre connexion.'); }
    Net.close(); let tries = 0, wantN = 2;
    const lobby = () => {
      const humans = 1 + Net.conns.length;
      modal('<h3>Salle privée</h3><p class="muted">Donnez ce code à vos amis :</p><div class="code">' + Net.code + '</div>' +
        '<div class="rank">👑 Vous (hôte)</div>' + Net.conns.map(c => '<div class="rank">🙂 ' + c.pname + '</div>').join('') +
        '<label>Nombre de joueurs (les places libres sont jouées par l\'ordinateur)</label><div class="opts" id="oN">' + [2, 3, 4].map(n => '<button class="opt' + (n === Math.max(wantN, humans) ? ' sel' : '') + '" data-v="' + n + '"' + (n < humans ? ' disabled' : '') + '>' + n + '</button>').join('') + '</div>' +
        '<div class="opts"><button class="btn" id="st">▶ Lancer</button><button class="btn ghost" id="cl">Fermer</button></div>', m => {
          opts(m, '#oN', v => wantN = +v);
          m.querySelector('#cl').onclick = () => { Net.close(); closeModal(); };
          m.querySelector('#st').onclick = () => {
            const n = Math.max(wantN, 1 + Net.conns.length, 2);
            const colors = n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3], hc = Net.conns.length;
            const names = colors.map((_, i) => i === 0 ? 'Hôte' : i <= hc ? Net.conns[i - 1].pname : 'Ordi');
            Net.conns.forEach((c, i) => { c.seat = i + 1; c.send({ k: 'start', colors, names, mySeat: i + 1 }); });
            startGame({ colors, names, kinds: colors.map((_, i) => i === 0 ? 'human' : i <= hc ? 'remote' : 'cpu'), ntok: 4, mySeat: 0, online: 'host', mode: 'online' });
          };
        });
    };
    const open = () => {
      const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
      const peer = new Peer(PREFIX + code); Net.peer = peer; Net.code = code;
      peer.on('open', lobby);
      peer.on('error', err => { if (err.type === 'unavailable-id' && tries++ < 5) { try { peer.destroy(); } catch (e) {} open(); } else errCard('Erreur réseau (' + err.type + ').'); });
      peer.on('connection', conn => {
        if (G || Net.conns.length >= 3) { conn.on('open', () => { conn.send({ k: 'full' }); setTimeout(() => conn.close(), 400); }); return; }
        conn.pname = 'Joueur ' + (Net.conns.length + 2);
        conn.on('open', () => { Net.conns.push(conn); if (!G) lobby(); });
        conn.on('data', m => {
          if (m.k === 'hello') { conn.pname = String(m.name || conn.pname).slice(0, 14); if (!G) lobby(); }
          else if (m.k === 'act' && G && conn.seat != null) hostAct(Object.assign({ seat: conn.seat }, m.a));
          else if (m.k === 'emo' && G) { showEmoji(m.seat, m.e); Net.conns.forEach(c => c !== conn && c.open && c.send(m)); }
        });
        conn.on('close', () => {
          Net.conns = Net.conns.filter(c => c !== conn);
          if (G && conn.seat != null) { G.cfg.kinds[conn.seat] = 'cpu'; G.cfg.names[conn.seat] += ' (ordi)'; buildHUD(); updateHUD(); drive(); }
          else if (!G) lobby();
        });
      });
    };
    open();
  }
  async function joinRoom(code) {
    modal('<h3>Connexion…</h3><p class="muted">Recherche de la salle ' + code + '</p>');
    try { await Net.load(); } catch (e) { return errCard('Impossible de charger le module en ligne. Vérifiez votre connexion.'); }
    Net.close(); const peer = new Peer(); Net.peer = peer;
    const fail = setTimeout(() => errCard('Salle introuvable. Vérifiez le code.'), 12000);
    peer.on('error', err => { clearTimeout(fail); errCard(err.type === 'peer-unavailable' ? 'Salle introuvable. Vérifiez le code.' : 'Erreur réseau (' + err.type + ').'); });
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { reliable: true }); Net.hostConn = conn;
      conn.on('open', () => {
        clearTimeout(fail); conn.send({ k: 'hello', name: 'Joueur' });
        modal('<h3>✅ Connecté à la salle ' + code + '</h3><p class="muted">En attente du lancement par l\'hôte…</p><button class="btn ghost" id="cl">Quitter</button>', m => m.querySelector('#cl').onclick = () => { Net.close(); closeModal(); });
      });
      conn.on('data', m => {
        if (m.k === 'start') startGame({ colors: m.colors, names: m.names, kinds: m.colors.map((_, i) => i === m.mySeat ? 'human' : 'remote'), ntok: 4, mySeat: m.mySeat, online: 'guest', mode: 'online' });
        else if (m.k === 'upd' && G) enqueue(m.ev, m.st);
        else if (m.k === 'emo' && G) showEmoji(m.seat, m.e);
        else if (m.k === 'full') { clearTimeout(fail); errCard('La salle est pleine ou la partie a déjà commencé.'); }
      });
      conn.on('close', () => { if (G && G.cfg.online === 'guest') { alert('L\'hôte a quitté la partie.'); quitToMenu(); } });
    });
  }

  // ---------- démarrage ----------
  addEventListener('pointerdown', () => FX.init(), { once: true });
  document.addEventListener('visibilitychange', () => FX.visibility && FX.visibility(!document.hidden));
  wallet(); Ads.init().then(() => Ads.banner($('#bannerMenu')));
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.__ludo = { get G() { return G; }, startGame };  // utile pour les tests
})();
