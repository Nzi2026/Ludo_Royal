/* Ludo Royal - audio 100 % synthétisé (aucun fichier requis).
   - Musique douce générative (accords + notes pincées + écho)
   - Rire moqueur quand un pion est mangé (peut être remplacé par assets/laugh.mp3)
*/
(function () {
  'use strict';
  let ctx = null, master, musicBus, sfxBus, echo, timer = null, nextT = 0, beat = 0;
  let musicOn = true, sfxOn = true, laughBuf = null, noiseBuf = null;
  const CH = [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 55]];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.17 : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.8 : 0; sfxBus.connect(master);
    // écho doux
    echo = ctx.createDelay(1); echo.delayTime.value = 0.34;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
    echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // fichier de rire optionnel
    fetch('assets/laugh.mp3',{method:'GET'}).then(r => r.ok && /audio/.test(r.headers.get('content-type')||'') ? r.arrayBuffer() : Promise.reject())
      .then(b => ctx.decodeAudioData(b)).then(buf => { laughBuf = buf; }).catch(() => {});
    if (musicOn) startMusic();
  }

  function pad(notes, t, dur) {
    notes.forEach(m => {
      [0, 4].forEach(det => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = mtof(m); o.detune.value = det;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.06, t + 1.3);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.1);
      });
    });
  }
  function pluck(m, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicBus); g.connect(echo); o.start(t); o.stop(t + dur + 0.05);
  }
  function sched() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 1.6) {
      const bar = Math.floor(beat / 8) % 4, ch = CH[bar];
      if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
      if (beat % 8 === 0) pad(ch, nextT, 4.4);
      if (Math.random() < 0.78) pluck(ch[(Math.random() * 4) | 0] + 12 * (1 + (Math.random() < 0.35 ? 1 : 0)), nextT, 1.6);
      beat++; nextT += 0.5;
    }
  }
  function startMusic() {
    if (!ctx || timer) return;
    nextT = ctx.currentTime + 0.1;
    timer = setInterval(sched, 500); sched();
  }
  function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }

  function tone(f, t, dur, type, vol, f2) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function noiseHit(t, dur, freq, vol) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random() * 0.2); s.stop(t + dur + 0.02);
  }

  const FX = {
    init,
    visibility(v) { if (!ctx) return; v ? ctx.resume() : ctx.suspend(); },
    setMusic(on) { musicOn = on; if (!ctx) return; musicBus.gain.value = on ? 0.17 : 0; on ? startMusic() : stopMusic(); },
    setSfx(on) { sfxOn = on; if (ctx) sfxBus.gain.value = on ? 0.8 : 0; },
    dice() { if (!ctx) return; const t = ctx.currentTime; for (let i = 0; i < 7; i++) noiseHit(t + i * 0.07 + Math.random() * 0.02, 0.05, 1800 + Math.random() * 2500, 0.5); },
    step() { if (!ctx) return; tone(520 + Math.random() * 40, ctx.currentTime, 0.07, 'sine', 0.22, 700); },
    home() { if (!ctx) return; const t = ctx.currentTime; [72, 76, 79, 84].forEach((m, i) => tone(mtof(m), t + i * 0.09, 0.4, 'triangle', 0.25)); },
    win() { if (!ctx) return; const t = ctx.currentTime; [67, 72, 76, 79, 84, 79, 84, 88].forEach((m, i) => tone(mtof(m), t + i * 0.12, 0.5, 'triangle', 0.28)); },
    pop() { if (!ctx) return; tone(600, ctx.currentTime, 0.12, 'sine', 0.3, 900); },
    fail() { if (!ctx) return; tone(300, ctx.currentTime, 0.3, 'sine', 0.25, 160); },
    // Rire moqueur : "HA ha-ha-ha-ha" avec formants de voyelle "a" et souffle, hauteur descendante.
    laugh() {
      if (!ctx || !sfxOn) return;
      if (laughBuf) { const s = ctx.createBufferSource(); s.buffer = laughBuf; s.connect(sfxBus); s.start(); return; }
      const t0 = ctx.currentTime + 0.02;
      const syl = [0, 0.26, 0.45, 0.62, 0.79, 0.96];
      syl.forEach((dt, i) => {
        const t = t0 + dt, len = i === 0 ? 0.2 : 0.12;
        const base = (i === 0 ? 330 : 290 - i * 14) * (1 + (Math.random() - 0.5) * 0.03);
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(base * 1.12, t);
        o.frequency.exponentialRampToValueAtTime(base * 0.8, t + len);
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 22; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(i === 0 ? 0.9 : 0.6, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        [[780, 1], [1250, 0.7], [2650, 0.25]].forEach(([fr, a]) => {
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = 7;
          const ga = ctx.createGain(); ga.gain.value = a; o.connect(bp); bp.connect(ga); ga.connect(g);
        });
        g.connect(sfxBus);
        o.start(t); o.stop(t + len + 0.02); lfo.start(t); lfo.stop(t + len + 0.02);
        noiseHit(t, 0.06, 3500, 0.25); // le "h" aspiré
      });
    },
  };
  window.AudioFX = FX;
})();
